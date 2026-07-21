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
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signInError) throw signInError;
  return client;
}

describe("Super-admin de plataforma (visão cross-tenant)", () => {
  let superAdmin: SupabaseClient;
  let adminA: SupabaseClient;
  let adminB: SupabaseClient;
  let churchA: string;
  let churchB: string;
  const run = Date.now();

  beforeAll(async () => {
    // e-mail na allowlist → deve virar super-admin no signup
    await admin
      .from("platform_admin_emails")
      .insert({ email: `super-${run}@teste.dev` });

    superAdmin = await newUser(`super-${run}@teste.dev`);
    adminA = await newUser(`adminA-${run}@teste.dev`);
    adminB = await newUser(`adminB-${run}@teste.dev`);

    const a = await adminA.rpc("create_church", {
      p_name: "Igreja A Super",
      p_slug: `igreja-a-super-${run}`,
    });
    churchA = a.data;
    const b = await adminB.rpc("create_church", {
      p_name: "Igreja B Super",
      p_slug: `igreja-b-super-${run}`,
    });
    churchB = b.data;
  });

  it("super-admin foi concedido automaticamente ao e-mail da allowlist", async () => {
    const { data } = await superAdmin.rpc("is_platform_admin");
    expect(data).toBe(true);
  });

  it("admin comum NÃO é super-admin", async () => {
    const { data } = await adminA.rpc("is_platform_admin");
    expect(data).toBe(false);
  });

  it("super-admin lê TODAS as igrejas (cross-tenant)", async () => {
    const { data } = await superAdmin.from("churches").select("id");
    const ids = data!.map((c) => c.id);
    expect(ids).toContain(churchA);
    expect(ids).toContain(churchB);
  });

  it("super-admin lê membros e patrimônio de qualquer igreja", async () => {
    await adminA
      .from("equipments")
      .insert({ church_id: churchA, name: "Câmera Super" });

    const { data: members } = await superAdmin
      .from("church_members")
      .select("church_id")
      .in("church_id", [churchA, churchB]);
    expect(members!.length).toBeGreaterThanOrEqual(2);

    const { data: eq } = await superAdmin
      .from("equipments")
      .select("name")
      .eq("church_id", churchA);
    expect(eq!.map((e) => e.name)).toContain("Câmera Super");
  });

  it("super-admin lê audit_logs de qualquer igreja", async () => {
    const { data } = await superAdmin
      .from("audit_logs")
      .select("id")
      .in("church_id", [churchA, churchB]);
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("admin da igreja A continua SEM ver a igreja B (isolamento intacto)", async () => {
    const { data } = await adminA.from("churches").select("id").eq("id", churchB);
    expect(data).toEqual([]);
  });

  it("MASTER opera (escreve) em qualquer igreja — cadastra equipamento na A", async () => {
    const { data, error } = await superAdmin
      .from("equipments")
      .insert({ church_id: churchA, name: "Equipamento cadastrado pelo master" })
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("MASTER cria evento e ministério em igreja alheia (atua como gestor)", async () => {
    const { error: evError } = await superAdmin.from("events").insert({
      church_id: churchB,
      title: "Evento criado pelo master",
      starts_at: new Date().toISOString(),
    });
    expect(evError).toBeNull();

    const { error: minError } = await superAdmin.from("ministries").insert({
      church_id: churchB,
      name: "Mídia (pelo master)",
      slug: `midia-master-${run}`,
    });
    expect(minError).toBeNull();
  });

  it("membro comum continua SEM operar em igreja alheia (isolamento intacto)", async () => {
    const { error } = await adminA.from("equipments").insert({
      church_id: churchB,
      name: "Intruso",
    });
    expect(error).not.toBeNull();
  });
});
