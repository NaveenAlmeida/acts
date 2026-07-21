"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Substitui o refresh de sessão que o middleware/proxy fazia.
 * No Cloudflare (Next 16) o proxy roda em Node e não é suportado pelo OpenNext,
 * então mantemos a sessão viva pelo cliente: o browser client renova o token
 * antes de expirar e persiste nos mesmos cookies que o servidor lê.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    // dispara o timer interno de auto-refresh e sincroniza cookies
    supabase.auth.getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // logout em outra aba ou expiração definitiva → recarrega para o gate de auth agir
      if (event === "SIGNED_OUT") router.refresh();
      // token renovado: os cookies já foram atualizados pelo client
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
