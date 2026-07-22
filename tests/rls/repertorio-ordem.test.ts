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
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return c;
}

// A sequência é o pedido central: "qual ordem de louvor vai ser". Reordenar
// esbarra na unique (event_id, position) — duas músicas passariam pela mesma
// posição no meio da troca. Estes testes provam que a manobra funciona.
describe("Repertório — a ordem das músicas (migration 27)", () => {
  let lider: SupabaseClient;
  let churchId: string;
  let eventId: string;
  const songs: string[] = [];
  const run = Date.now();

  beforeAll(async () => {
    lider = await newUser(`ord-lider-${run}@teste.dev`);
    churchId = (
      await lider.rpc("create_church", { p_name: "Igreja Ordem", p_slug: `ord-${run}` })
    ).data;
    const louvorId = (
      await lider
        .from("ministries")
        .insert({ church_id: churchId, name: "Louvor", slug: "louvor" })
        .select("id")
        .single()
    ).data!.id;
    const uid = (await lider.auth.getUser()).data.user!.id;
    await admin
      .from("ministry_members")
      .insert({ ministry_id: louvorId, church_id: churchId, user_id: uid, role: "lider" });

    eventId = (
      await lider
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    for (const nome of ["Primeira", "Segunda", "Terceira"]) {
      const id = (
        await lider
          .from("songs")
          .insert({ church_id: churchId, title: `${nome} ${run}` })
          .select("id")
          .single()
      ).data!.id;
      songs.push(id);
      await lider.from("setlist_items").insert({
        church_id: churchId,
        event_id: eventId,
        song_id: id,
        position: songs.length,
      });
    }
  });

  const ordem = async () => {
    const { data } = await lider
      .from("setlist_items")
      .select("song_id, position")
      .eq("event_id", eventId)
      .order("position");
    return (data ?? []).map((i) => songs.indexOf(i.song_id));
  };

  it("começa na ordem em que foi montada", async () => {
    expect(await ordem()).toEqual([0, 1, 2]);
  });

  // Reproduz o que a action faz: estacionar a vizinha numa posição livre acima
  // de todas antes de trocar. Posição negativa NÃO serve (check position > 0).
  it("troca duas músicas de lugar sem violar a unique", async () => {
    const { data: itens } = await lider
      .from("setlist_items")
      .select("id, position")
      .eq("event_id", eventId)
      .order("position");
    const [a, b] = itens!;
    const estacionamento = Math.max(...itens!.map((x) => x.position)) + 1;

    const { error: e1 } = await lider
      .from("setlist_items")
      .update({ position: estacionamento })
      .eq("id", b.id);
    expect(e1).toBeNull();
    await lider.from("setlist_items").update({ position: b.position }).eq("id", a.id);
    await lider.from("setlist_items").update({ position: a.position }).eq("id", b.id);

    expect(await ordem()).toEqual([1, 0, 2]);
  });

  it("posição negativa é recusada pelo banco (por isso o estacionamento)", async () => {
    const { data: item } = await lider
      .from("setlist_items")
      .select("id")
      .eq("event_id", eventId)
      .limit(1)
      .single();
    const { error } = await lider
      .from("setlist_items")
      .update({ position: -1 })
      .eq("id", item!.id);
    expect(error).not.toBeNull();
  });

  it("a mesma música não entra duas vezes no mesmo culto", async () => {
    const { error } = await lider.from("setlist_items").insert({
      church_id: churchId,
      event_id: eventId,
      song_id: songs[0],
      position: 9,
    });
    expect(error).not.toBeNull();
  });

  it("publicar sem música nenhuma não faz sentido — o culto tem 3", async () => {
    const { data } = await lider.from("setlist_items").select("id").eq("event_id", eventId);
    expect(data).toHaveLength(3);
  });
});
