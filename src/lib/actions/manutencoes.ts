"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reaisToCents } from "@/lib/utils";
import type { ActionResult } from "./types";

const createTicketSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  equipmentId: z.string().uuid("Escolha o equipamento"),
  title: z.string().min(2, "Descreva o problema").max(120),
  description: z.string().max(2000).default(""),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
});

export async function createTicket(raw: unknown): Promise<ActionResult> {
  const parsed = createTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: created, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      church_id: d.churchId,
      equipment_id: d.equipmentId,
      opened_by: user?.id ?? null,
      title: d.title,
      description: d.description || null,
      priority: d.priority,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: "Sem permissão para abrir chamados" };
  }
  revalidatePath(`/${d.churchSlug}/manutencoes`);
  redirect(`/${d.churchSlug}/manutencoes/${created.id}`);
}

const updateTicketSchema = z.object({
  churchSlug: z.string().min(2),
  ticketId: z.string().uuid(),
  status: z.enum([
    "aberto",
    "em_andamento",
    "aguardando_peca",
    "concluido",
    "cancelado",
  ]),
  supplier: z.string().max(120).default(""),
  parts: z.string().max(1000).default(""),
  costReais: z.coerce.number().min(0).nullable().default(null),
});

export async function updateTicket(raw: unknown): Promise<ActionResult> {
  const parsed = updateTicketSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .update({
      status: d.status,
      supplier: d.supplier || null,
      parts: d.parts || null,
      cost_cents: reaisToCents(d.costReais),
    })
    .eq("id", d.ticketId)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para atualizar o chamado" };
  }
  revalidatePath(`/${d.churchSlug}/manutencoes/${d.ticketId}`);
  revalidatePath(`/${d.churchSlug}/manutencoes`);
  return { ok: true, data: undefined };
}
