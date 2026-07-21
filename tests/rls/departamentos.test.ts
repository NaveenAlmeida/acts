import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return client;
}

describe("Departamentos (RLS)", () => {
  let adminC: SupabaseClient;
  let membro: SupabaseClient;
  let churchId: string;
  const run = Date.now();

  beforeAll(async () => {
    adminC = await newUser(`dep-admin-${run}@teste.dev`);
    membro = await newUser(`dep-membro-${run}@teste.dev`);

    const a = await adminC.rpc("create_church", {
      p_name: "Igreja Dep",
      p_slug: `igreja-dep-${run}`,
    });
    churchId = a.data;

    const { data: church } = await adminC
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await membro.rpc("join_church", { p_invite_code: church!.invite_code });
  });

  it("admin cria departamento; começa vazio (sem seed)", async () => {
    const { data: before } = await adminC
      .from("departments")
      .select("id")
      .eq("church_id", churchId);
    expect(before).toEqual([]);

    const { error } = await adminC
      .from("departments")
      .insert({ church_id: churchId, name: "UMADESP (Jovens)" });
    expect(error).toBeNull();
  });

  it("membro comum lê os departamentos mas NÃO cria", async () => {
    const { data } = await membro
      .from("departments")
      .select("name")
      .eq("church_id", churchId);
    expect(data!.map((d) => d.name)).toContain("UMADESP (Jovens)");

    const { error } = await membro
      .from("departments")
      .insert({ church_id: churchId, name: "Pirata" });
    expect(error).not.toBeNull();
  });

  it("evento pode apontar para um departamento", async () => {
    const { data: dep } = await adminC
      .from("departments")
      .select("id")
      .eq("church_id", churchId)
      .single();

    const { data, error } = await adminC
      .from("events")
      .insert({
        church_id: churchId,
        title: "Culto dos Jovens",
        starts_at: new Date().toISOString(),
        department_id: dep!.id,
      })
      .select("department_id")
      .single();
    expect(error).toBeNull();
    expect(data!.department_id).toBe(dep!.id);
  });
});
