"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { proximoVencimento } from "@/lib/billing";
import type { ActionResult } from "./types";

const claimSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  note: z.string().max(300).default(""),
});

/** A igreja avisa que pagou; a plataforma confere depois (Pix não tem webhook). */
export async function claimPayment(raw: unknown): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("billing_claims").insert({
    church_id: d.churchId,
    claimed_by: user.id,
    note: d.note || null,
  });
  if (error) return { ok: false, error: "Não foi possível registrar o aviso" };
  revalidatePath(`/${d.churchSlug}/assinatura`);
  return { ok: true, data: undefined };
}

/**
 * Plataforma confirma o pagamento: soma 1 mês a partir do vencimento atual
 * (ou de hoje, se já venceu). O trigger churches_guard_billing garante que
 * só o super-admin consegue — o admin da igreja não se auto-libera.
 */
export async function confirmPayment(churchId: string, meses = 1): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: church } = await supabase
    .from("churches")
    .select("paid_until")
    .eq("id", churchId)
    .single();

  const novo = proximoVencimento(church?.paid_until ?? null, meses);

  const { error } = await supabase
    .from("churches")
    .update({ billing_status: "ativa", paid_until: novo })
    .eq("id", churchId);
  if (error) return { ok: false, error: "Sem permissão para confirmar pagamento" };
  revalidatePath("/painel");
  return { ok: true, data: undefined };
}

/** Plataforma isenta a igreja que não tem condição de pagar. */
export async function exemptChurch(churchId: string, note = ""): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("churches")
    .update({
      billing_status: "isenta",
      billing_note: note || "isenta a pedido",
    })
    .eq("id", churchId);
  if (error) return { ok: false, error: "Sem permissão para isentar" };
  revalidatePath("/painel");
  return { ok: true, data: undefined };
}
