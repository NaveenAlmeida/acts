"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const childSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  fullName: z.string().min(2, "Informe o nome da criança").max(120),
  birthDate: z.string().min(10, "Informe a data de nascimento"),
  allergies: z.string().max(500).default(""),
  healthNotes: z.string().max(1000).default(""),
  specialNeeds: z.string().max(1000).default(""),
  emergencyName: z.string().max(120).default(""),
  emergencyPhone: z.string().max(30).default(""),
  photoConsent: z.boolean().default(false),
  // consentimento do responsável é obrigatório (LGPD art. 14)
  consent: z.literal(true, { message: "É preciso o consentimento do responsável" }),
  guardianName: z.string().min(2, "Informe o responsável").max(120),
  guardianPhone: z.string().max(30).default(""),
  guardianRelationship: z.string().max(40).default(""),
});

/** Cadastra a criança + o responsável principal (já autorizado a retirar). */
export async function createChild(raw: unknown): Promise<ActionResult> {
  const parsed = childSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: guardian, error: gErr } = await supabase
    .from("guardians")
    .insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      full_name: d.guardianName,
      phone: d.guardianPhone || null,
    })
    .select("id")
    .single();
  if (gErr || !guardian) return { ok: false, error: "Sem permissão para cadastrar" };

  const { data: child, error: cErr } = await supabase
    .from("children")
    .insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      full_name: d.fullName,
      birth_date: d.birthDate,
      allergies: d.allergies || null,
      health_notes: d.healthNotes || null,
      special_needs: d.specialNeeds || null,
      emergency_contact_name: d.emergencyName || null,
      emergency_contact_phone: d.emergencyPhone || null,
      consent_guardian_id: guardian.id,
      photo_consent: d.photoConsent,
      photo_consent_at: d.photoConsent ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (cErr || !child) return { ok: false, error: "Não foi possível cadastrar a criança" };

  // responsável principal já entra autorizado a retirar
  const { error: linkErr } = await supabase.from("child_guardians").insert({
    child_id: child.id,
    guardian_id: guardian.id,
    church_id: d.churchId,
    relationship: d.guardianRelationship || null,
    can_pickup: true,
    is_primary: true,
  });
  if (linkErr) return { ok: false, error: "Criança criada, mas o responsável não vinculou" };

  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}

const guardianSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  childId: z.string().uuid(),
  fullName: z.string().min(2, "Informe o nome").max(120),
  phone: z.string().max(30).default(""),
  relationship: z.string().max(40).default(""),
  canPickup: z.boolean().default(true),
});

/** Adiciona outro responsável à criança (autorizado ou não a retirar). */
export async function addGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = guardianSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: g, error: gErr } = await supabase
    .from("guardians")
    .insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      full_name: d.fullName,
      phone: d.phone || null,
    })
    .select("id")
    .single();
  if (gErr || !g) return { ok: false, error: "Sem permissão para adicionar responsável" };

  const { error } = await supabase.from("child_guardians").insert({
    child_id: d.childId,
    guardian_id: g.id,
    church_id: d.churchId,
    relationship: d.relationship || null,
    can_pickup: d.canPickup,
    is_primary: false,
  });
  if (error) return { ok: false, error: "Não foi possível vincular o responsável" };

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  return { ok: true, data: undefined };
}

const checkinSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  childId: z.string().uuid(),
  classId: z.string().uuid().nullable().default(null),
});

/** Check-in: registra a presença e gera o código de chamada da sessão. */
export async function checkInChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // código curto e único na sessão — tenta algumas vezes em caso de colisão
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100 + Math.random() * 900));
    const { error } = await supabase.from("child_checkins").insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      event_id: d.eventId,
      child_id: d.childId,
      class_id: d.classId,
      code,
      checked_in_by: user?.id ?? null,
    });
    if (!error) {
      revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
      return { ok: true, data: undefined };
    }
    if (error.code === "23505" && error.message.includes("child_id")) {
      return { ok: false, error: "Esta criança já fez check-in nesta sessão" };
    }
    if (error.code !== "23505") {
      return { ok: false, error: "Sem permissão para fazer check-in" };
    }
    // colisão de código: tenta outro
  }
  return { ok: false, error: "Não foi possível gerar um código livre" };
}

const checkoutSchema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  checkinId: z.string().uuid(),
  guardianId: z.string().uuid(),
  overrideReason: z.string().max(300).default(""),
});

/**
 * Retirada. O banco (guard_child_pickup) é quem decide: se o responsável não
 * está na lista de autorizados, exige justificativa E liderança.
 */
export async function checkOutChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("child_checkins")
    .update({
      picked_up_by: d.guardianId,
      checked_out_at: new Date().toISOString(),
      checked_out_by: user?.id ?? null,
      override_reason: d.overrideReason || null,
    })
    .eq("id", d.checkinId);

  if (error) {
    if (error.message.includes("pickup_not_authorized")) {
      return {
        ok: false,
        error: "Essa pessoa não está autorizada a retirar. Chame a liderança para liberar com justificativa.",
      };
    }
    if (error.message.includes("override_requires_leader")) {
      return { ok: false, error: "Só a liderança do setor pode liberar uma retirada excepcional." };
    }
    return { ok: false, error: "Não foi possível registrar a retirada" };
  }
  revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
  return { ok: true, data: undefined };
}

/** Cria as turmas padrão por faixa etária. */
export async function seedClasses(
  churchSlug: string,
  ministryId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_child_classes", { p_ministry: ministryId });
  if (error) return { ok: false, error: "Não foi possível criar as turmas" };
  revalidatePath(`/${churchSlug}/infantil`);
  return { ok: true, data: undefined };
}
