import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  await admin.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return client;
}

// Bucket 'media' privado (migration 16): leitura só via signed URL e
// restrita ao membro da igreja dona do arquivo (path = church_id/...).
describe("Isolamento de mídia por igreja (bucket privado)", () => {
  let lider: SupabaseClient; // gestor da igreja A (faz upload)
  let outro: SupabaseClient; // admin da igreja B (não deve acessar)
  let churchA: string;
  let path: string;
  const run = Date.now();

  beforeAll(async () => {
    lider = await newUser(`media-a-${run}@teste.dev`);
    outro = await newUser(`media-b-${run}@teste.dev`);
    churchA = (
      await lider.rpc("create_church", { p_name: "Media A", p_slug: `media-a-${run}` })
    ).data;
    await outro.rpc("create_church", { p_name: "Media B", p_slug: `media-b-${run}` });

    // gestor de A faz upload de um arquivo sob o próprio church_id
    path = `${churchA}/equipments/${crypto.randomUUID()}.txt`;
    const blob = new Blob(["foto-fake"], { type: "text/plain" });
    const up = await lider.storage.from("media").upload(path, blob);
    expect(up.error).toBeNull();
  });

  it("bucket media não é mais público", async () => {
    const { data } = await admin.storage.getBucket("media");
    expect(data?.public).toBe(false);
  });

  it("gestor da própria igreja gera signed URL do seu arquivo", async () => {
    const { data, error } = await lider.storage
      .from("media")
      .createSignedUrl(path, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  it("membro de outra igreja NÃO gera signed URL do arquivo alheio", async () => {
    const { data, error } = await outro.storage
      .from("media")
      .createSignedUrl(path, 60);
    // policy media_read bloqueia: sem signed URL
    expect(error !== null || !data?.signedUrl).toBe(true);
  });
});
