"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const subscriptionSchema = z.object({
  churchId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/** Salva (ou atualiza) a inscrição Web Push deste aparelho para o usuário logado. */
export async function savePushSubscription(raw: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        church_id: d.churchId,
        user_id: user.id,
        endpoint: d.endpoint,
        p256dh: d.p256dh,
        auth: d.auth,
      },
      { onConflict: "endpoint" }
    );
  if (error) return { ok: false, error: "Não foi possível ativar os avisos" };
  return { ok: true, data: undefined };
}

/** Remove a inscrição deste aparelho (ao desativar os avisos). */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: "Não foi possível desativar os avisos" };
  return { ok: true, data: undefined };
}
