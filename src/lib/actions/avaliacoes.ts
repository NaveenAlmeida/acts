"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const nota = z.number().int().min(1).max(5);

const evaluationSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  pontualidade: nota,
  organizacao: nota,
  conhecimento: nota,
  comunicacao: nota,
  trabalho_equipe: nota,
  comprometimento: nota,
  notes: z.string().max(2000).default(""),
});

export async function submitEvaluation(raw: unknown): Promise<ActionResult> {
  const parsed = evaluationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Preencha as 6 notas de 1 a 5" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data, error } = await supabase
    .from("evaluations")
    .upsert(
      {
        church_id: d.churchId,
        assignment_id: d.assignmentId,
        event_id: d.eventId,
        user_id: d.userId,
        evaluator_id: user.id,
        pontualidade: d.pontualidade,
        organizacao: d.organizacao,
        conhecimento: d.conhecimento,
        comunicacao: d.comunicacao,
        trabalho_equipe: d.trabalho_equipe,
        comprometimento: d.comprometimento,
        notes: d.notes || null,
      },
      { onConflict: "assignment_id" }
    )
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para avaliar" };
  }
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}/pessoas/${d.userId}`);
  return { ok: true, data: undefined };
}
