import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que o usuário é super-admin da plataforma (visão global).
 * Redireciona para /login se deslogado, ou para / se não for super-admin.
 */
export const getPlatformAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/");

  return { userId: user.id };
});

/** Só verifica (sem redirect) — para decidir se mostra o link do painel. */
export async function checkPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("is_platform_admin");
  return Boolean(data);
}
