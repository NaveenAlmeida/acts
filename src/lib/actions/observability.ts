"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const corta = (s: string | undefined | null, n: number) =>
  s ? s.slice(0, n) : null;

/**
 * Registra um erro de produção. Chamado pelas error boundaries.
 *
 * Regras: nunca lança (um erro ao registrar erro não pode quebrar a tela de
 * erro) e nunca bloqueia — é best-effort.
 */
export async function reportError(input: {
  message: string;
  digest?: string;
  stack?: string;
  path?: string;
  churchId?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ua = (await headers()).get("user-agent");

    await supabase.from("error_logs").insert({
      church_id: input.churchId ?? null,
      user_id: user?.id ?? null,
      path: corta(input.path, 300),
      message: corta(input.message, 500) ?? "erro sem mensagem",
      digest: corta(input.digest, 100),
      stack: corta(input.stack, 4000),
      user_agent: corta(ua, 300),
    });
  } catch {
    // silencioso de propósito: o usuário já está vendo uma tela de erro.
  }
}
