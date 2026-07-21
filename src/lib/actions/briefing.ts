"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { briefingSchema, generateSummary } from "@/lib/briefing";
import type { ActionResult } from "./types";

/**
 * Libera o acesso sem responder o briefing. O voluntário convidado de
 * última hora quer só ver se está escalado — 5 telas de perguntas não
 * podem ser um pedágio. Ele responde depois, quando fizer sentido.
 */
export async function skipBriefing(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (error) {
    console.error("skipBriefing:", error);
    return { ok: false, error: "Não foi possível continuar" };
  }
  redirect("/");
}

export async function submitBriefing(raw: unknown): Promise<ActionResult> {
  const parsed = briefingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Respostas inválidas, revise o formulário" };
  }
  const answers = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("church_members")
    .select("church_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/comecar");
  const churchId = membership.church_id;

  const { data: skills } = await supabase
    .from("skills")
    .select("id, slug, name")
    .eq("church_id", churchId);
  const skillNames = new Map((skills ?? []).map((s) => [s.slug, s.name]));
  const skillIds = new Map((skills ?? []).map((s) => [s.slug, s.id]));

  const summary = generateSummary(answers, skillNames);

  const { error: briefingError } = await supabase
    .from("briefing_responses")
    .insert({
      church_id: churchId,
      user_id: user.id,
      form_version: 1,
      answers,
      summary,
    });
  if (briefingError && briefingError.code !== "23505") {
    return { ok: false, error: "Não foi possível salvar o briefing" };
  }

  // sugestões de aptidão (pendentes de aprovação do gerente)
  const suggestions = answers.experiencia
    .map((slug) => skillIds.get(slug))
    .filter((id): id is string => Boolean(id))
    .map((skillId) => ({
      skill_id: skillId,
      church_id: churchId,
      user_id: user.id,
      source: "experience" as const,
    }));
  if (suggestions.length > 0) {
    await supabase
      .from("member_skills")
      .upsert(suggestions, { onConflict: "skill_id,user_id", ignoreDuplicates: true });
  }

  // interesses: o que a pessoa QUER servir (antes era guardado e ignorado)
  const interests = answers.interesses
    .map((slug) => skillIds.get(slug))
    .filter((id): id is string => Boolean(id))
    .map((skillId) => ({
      skill_id: skillId,
      church_id: churchId,
      user_id: user.id,
    }));
  if (interests.length > 0) {
    await supabase
      .from("member_interests")
      .upsert(interests, { onConflict: "user_id,skill_id", ignoreDuplicates: true });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      profession: answers.profissao || null,
      availability: {
        dias: answers.dias,
        periodos: answers.periodos,
        tempoDisponivel: answers.tempoDisponivel,
      },
      onboarding_completed: true,
    })
    .eq("id", user.id);
  if (profileError) {
    return { ok: false, error: "Não foi possível atualizar o perfil" };
  }

  redirect("/");
}
