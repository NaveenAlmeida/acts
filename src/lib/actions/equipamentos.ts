"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reaisToCents } from "@/lib/utils";
import type { ActionResult } from "./types";

const equipmentSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Informe o nome").max(120),
  categoryId: z.string().uuid().nullable().default(null),
  subcategory: z.string().max(80).default(""),
  brand: z.string().max(80).default(""),
  model: z.string().max(80).default(""),
  serialNumber: z.string().max(120).default(""),
  assetNumber: z.string().max(120).default(""),
  valueReais: z.coerce
    .number()
    .min(0, "Valor não pode ser negativo")
    .nullable()
    .default(null),
  supplier: z.string().max(120).default(""),
  invoiceRef: z.string().max(200).default(""),
  warrantyUntil: z.string().default(""),
  manualUrl: z.string().max(500).default(""),
  photoUrl: z.string().max(500).default(""),
  status: z
    .enum(["disponivel", "em_uso", "manutencao", "emprestado", "indisponivel", "baixado"])
    .default("disponivel"),
  location: z.string().max(120).default(""),
  purchaseDate: z.string().default(""),
  lifespanMonths: z.coerce
    .number()
    .int()
    .positive("Vida útil deve ser maior que zero")
    .nullable()
    .default(null),
  responsibleId: z.string().uuid().nullable().default(null),
  ownerId: z.string().uuid().nullable().default(null),
  notes: z.string().max(2000).default(""),
});

function toRow(data: z.infer<typeof equipmentSchema>) {
  return {
    church_id: data.churchId,
    category_id: data.categoryId,
    name: data.name,
    subcategory: data.subcategory || null,
    brand: data.brand || null,
    model: data.model || null,
    serial_number: data.serialNumber || null,
    asset_number: data.assetNumber || null,
    value_cents: reaisToCents(data.valueReais),
    supplier: data.supplier || null,
    invoice_ref: data.invoiceRef || null,
    warranty_until: data.warrantyUntil || null,
    manual_url: data.manualUrl || null,
    photo_url: data.photoUrl || null,
    status: data.status,
    location: data.location || null,
    purchase_date: data.purchaseDate || null,
    lifespan_months: data.lifespanMonths,
    responsible_id: data.responsibleId,
    owner_id: data.ownerId,
    notes: data.notes || null,
  };
}

export async function saveEquipment(raw: unknown): Promise<ActionResult> {
  const parsed = equipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // Reforço: quem não é gestor só cria/edita equipamento PRÓPRIO (pessoal).
  // (A RLS já garante isso; aqui damos uma mensagem clara e evitamos tentativa.)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isManager } = await supabase.rpc("is_church_manager", {
    p_church: data.churchId,
  });
  if (!isManager && user) {
    data.ownerId = user.id; // trava no próprio dono
  }

  if (data.id) {
    const { data: updated, error } = await supabase
      .from("equipments")
      .update(toRow(data))
      .eq("id", data.id)
      .select();
    if (error || !updated || updated.length === 0) {
      return { ok: false, error: "Sem permissão para editar equipamentos" };
    }
    revalidatePath(`/${data.churchSlug}/equipamentos/${data.id}`);
    redirect(`/${data.churchSlug}/equipamentos/${data.id}`);
  }

  const { data: created, error } = await supabase
    .from("equipments")
    .insert(toRow(data))
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: "Sem permissão para cadastrar equipamentos" };
  }
  revalidatePath(`/${data.churchSlug}/equipamentos`);
  redirect(`/${data.churchSlug}/equipamentos/${created.id}`);
}
