"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const addSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  startDate: z.string().min(10, "Escolha a data de início"),
  endDate: z.string().min(10, "Escolha a data de fim"),
  reason: z.string().max(200).default(""),
});

/** Marca um período em que o voluntário não pode servir (o próprio usuário). */
export async function addUnavailability(raw: unknown): Promise<ActionResult> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.endDate < d.startDate) {
    return { ok: false, error: "A data de fim não pode ser antes do início" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("unavailability").insert({
    church_id: d.churchId,
    user_id: user.id,
    start_date: d.startDate,
    end_date: d.endDate,
    reason: d.reason || null,
  });
  if (error) {
    console.error("addUnavailability:", error);
    return { ok: false, error: "Não foi possível salvar" };
  }
  revalidatePath(`/${d.churchSlug}/pessoas/${user.id}`);
  revalidatePath(`/${d.churchSlug}/perfil`);
  return { ok: true, data: undefined };
}

const removeSchema = z.object({
  churchSlug: z.string().min(2),
  id: z.string().uuid(),
});

export async function removeUnavailability(raw: unknown): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, id } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unavailability")
    .delete()
    .eq("id", id)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Não foi possível remover" };
  }
  revalidatePath(`/${churchSlug}/perfil`);
  return { ok: true, data: undefined };
}

const interestSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  skillId: z.string().uuid(),
  wants: z.boolean(),
});

/** Liga/desliga o interesse do próprio usuário numa aptidão. */
export async function setInterest(raw: unknown): Promise<ActionResult> {
  const parsed = interestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, churchId, skillId, wants } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const op = wants
    ? supabase.from("member_interests").upsert(
        { church_id: churchId, user_id: user.id, skill_id: skillId },
        { onConflict: "user_id,skill_id", ignoreDuplicates: true }
      )
    : supabase
        .from("member_interests")
        .delete()
        .eq("user_id", user.id)
        .eq("skill_id", skillId);

  const { error } = await op;
  if (error) {
    console.error("setInterest:", error);
    return { ok: false, error: "Não foi possível atualizar o interesse" };
  }
  revalidatePath(`/${churchSlug}/pessoas/${user.id}`);
  revalidatePath(`/${churchSlug}/perfil`);
  return { ok: true, data: undefined };
}
