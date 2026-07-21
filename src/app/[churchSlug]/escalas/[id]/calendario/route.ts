import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

const TWO_HOURS = 2 * 60 * 60 * 1000;

/**
 * Gera o arquivo .ics do evento para "adicionar ao calendário". A RLS
 * garante que só quem tem acesso à igreja baixa o evento. O celular
 * abre o text/calendar no app de agenda nativo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ churchSlug: string; id: string }> }
) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, location, description, script, starts_at, ends_at")
    .eq("id", id)
    .eq("church_id", tenant.church.id)
    .maybeSingle();

  if (!event) {
    return new Response("Evento não encontrado", { status: 404 });
  }

  const start = new Date(event.starts_at);
  const end = event.ends_at
    ? new Date(event.ends_at)
    : new Date(start.getTime() + TWO_HOURS);

  const ics = buildIcs({
    uid: `${event.id}@acts`,
    title: event.title,
    start,
    end,
    location: event.location,
    description: event.description || event.script || null,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="escala.ics"',
    },
  });
}
