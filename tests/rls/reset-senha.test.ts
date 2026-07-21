import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function anon(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Fluxo de recuperação de senha (Fase 1 da auditoria): sem ele, quem
// esquece a senha fica permanentemente travado.
describe("Recuperação de senha", () => {
  const run = Date.now();
  const email = `reset-${run}@teste.dev`;
  const senhaAntiga = "senha-antiga-123";
  const senhaNova = "senha-nova-456";

  beforeAll(async () => {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: senhaAntiga,
      email_confirm: true,
      user_metadata: { full_name: "Reset Teste" },
    });
    if (error) throw error;
  });

  it("pedido de reset é aceito para e-mail existente", async () => {
    const { error } = await anon().auth.resetPasswordForEmail(email, {
      redirectTo: "http://127.0.0.1:3000/redefinir-senha",
    });
    expect(error).toBeNull();
  });

  it("não vaza se o e-mail existe (mesma resposta p/ inexistente)", async () => {
    const { error } = await anon().auth.resetPasswordForEmail(
      `naoexiste-${run}@teste.dev`,
      { redirectTo: "http://127.0.0.1:3000/redefinir-senha" }
    );
    expect(error).toBeNull();
  });

  it("gera link de recuperação válido", async () => {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    expect(error).toBeNull();
    expect(data?.properties?.action_link).toBeTruthy();
  });

  it("troca a senha: a nova funciona e a antiga deixa de funcionar", async () => {
    // sessão do usuário (equivale à sessão de recuperação do link)
    const client = anon();
    const login = await client.auth.signInWithPassword({
      email,
      password: senhaAntiga,
    });
    expect(login.error).toBeNull();

    const { error: updErr } = await client.auth.updateUser({
      password: senhaNova,
    });
    expect(updErr).toBeNull();

    // nova senha entra
    const comNova = await anon().auth.signInWithPassword({
      email,
      password: senhaNova,
    });
    expect(comNova.error).toBeNull();
    expect(comNova.data.session).toBeTruthy();

    // antiga não entra mais
    const comAntiga = await anon().auth.signInWithPassword({
      email,
      password: senhaAntiga,
    });
    expect(comAntiga.error).not.toBeNull();
  });
});
