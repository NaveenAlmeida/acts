import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AssignmentManager,
  type AssignmentRow,
} from "@/components/escalas/assignment-manager";
import { MyAssignmentCard } from "@/components/escalas/my-assignment-card";
import {
  EvaluationPanel,
  type EvaluationValues,
} from "@/components/escalas/evaluation-panel";

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const [{ data: event }, { data: assignments }] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_types(name), departments(name)")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select(
        "id, user_id, role_name, status, arrival_time, items_to_bring, profiles!assignments_user_id_fkey(full_name), leader:profiles!assignments_leader_id_fkey(full_name)"
      )
      .eq("event_id", id)
      .order("created_at"),
  ]);

  if (!event) notFound();

  // vínculos de equipamento SÓ deste evento (antes puxava todos da igreja)
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: links } = assignmentIds.length
    ? await supabase
        .from("assignment_equipments")
        .select("assignment_id, equipments!inner(id, name)")
        .in("assignment_id", assignmentIds)
    : { data: [] as { assignment_id: string; equipments: unknown }[] };
  const type = event.event_types as unknown as { name: string } | null;
  const dept = event.departments as unknown as { name: string } | null;

  const equipByAssignment = new Map<string, { id: string; name: string }[]>();
  for (const l of links ?? []) {
    const eq = l.equipments as unknown as { id: string; name: string };
    equipByAssignment.set(l.assignment_id, [
      ...(equipByAssignment.get(l.assignment_id) ?? []),
      eq,
    ]);
  }

  const rows: AssignmentRow[] = (assignments ?? []).map((a) => ({
    id: a.id,
    user_id: a.user_id,
    full_name:
      (a.profiles as unknown as { full_name: string })?.full_name ?? "—",
    role_name: a.role_name,
    status: a.status,
    equipments: equipByAssignment.get(a.id) ?? [],
  }));

  const mine = (assignments ?? []).find((a) => a.user_id === tenant.userId);

  let members: {
    user_id: string;
    full_name: string;
    cargaMes: number;
    indisponivel: boolean;
    aptidoes: string[];
    interesses: string[];
  }[] = [];
  let equipments: { id: string; name: string }[] = [];
  let evaluations = new Map<string, EvaluationValues>();
  if (tenant.isLeader) {
    const { data: evals } = await supabase
      .from("evaluations")
      .select(
        "assignment_id, pontualidade, organizacao, conhecimento, comunicacao, trabalho_equipe, comprometimento, notes"
      )
      .eq("event_id", id);
    evaluations = new Map(
      (evals ?? []).map((e) => [
        e.assignment_id,
        {
          pontualidade: e.pontualidade,
          organizacao: e.organizacao,
          conhecimento: e.conhecimento,
          comunicacao: e.comunicacao,
          trabalho_equipe: e.trabalho_equipe,
          comprometimento: e.comprometimento,
          notes: e.notes ?? "",
        },
      ])
    );
  }
  if (tenant.isLeader) {
    // janela do mês do evento (para a "carga do mês") e o dia do evento
    const dt = new Date(event.starts_at);
    const mesIni = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString();
    const mesFim = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).toISOString();
    const eventoDia = (event.starts_at as string).slice(0, 10);
    const cid = tenant.church.id;

    const [
      { data: m },
      { data: eq },
      { data: cargas },
      { data: indisp },
      { data: apts },
      { data: ints },
    ] = await Promise.all([
      supabase
        .from("church_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", cid)
        .eq("status", "active"),
      supabase
        .from("equipments")
        .select("id, name")
        .eq("church_id", cid)
        .in("status", ["disponivel", "em_uso"])
        .order("name"),
      supabase
        .from("assignments")
        .select("user_id, events!inner(starts_at)")
        .eq("church_id", cid)
        .gte("events.starts_at", mesIni)
        .lt("events.starts_at", mesFim),
      supabase
        .from("unavailability")
        .select("user_id")
        .eq("church_id", cid)
        .lte("start_date", eventoDia)
        .gte("end_date", eventoDia),
      supabase
        .from("member_skills")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid)
        .not("approved_by", "is", null),
      supabase
        .from("member_interests")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid),
    ]);

    const cargaBy = new Map<string, number>();
    for (const a of cargas ?? [])
      cargaBy.set(a.user_id, (cargaBy.get(a.user_id) ?? 0) + 1);
    const indispSet = new Set((indisp ?? []).map((u) => u.user_id));
    const skillsBy = new Map<string, string[]>();
    for (const s of apts ?? []) {
      const nome = (s.skills as unknown as { name: string }).name;
      skillsBy.set(s.user_id, [...(skillsBy.get(s.user_id) ?? []), nome]);
    }
    const intBy = new Map<string, string[]>();
    for (const i of ints ?? []) {
      const nome = (i.skills as unknown as { name: string }).name;
      intBy.set(i.user_id, [...(intBy.get(i.user_id) ?? []), nome]);
    }

    members = (m ?? []).map((x) => ({
      user_id: x.user_id,
      full_name: (x.profiles as unknown as { full_name: string }).full_name,
      cargaMes: cargaBy.get(x.user_id) ?? 0,
      indisponivel: indispSet.has(x.user_id),
      aptidoes: skillsBy.get(x.user_id) ?? [],
      interesses: intBy.get(x.user_id) ?? [],
    }));
    equipments = eq ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {type?.name ?? "Evento"}
          {dept?.name ? ` · ${dept.name}` : ""} ·{" "}
          {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
          {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {event.title}
        </h1>
        {event.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {event.map_url ? (
              <a
                href={event.map_url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {event.location}
              </a>
            ) : (
              event.location
            )}
          </p>
        )}
      </div>

      {mine && (
        <MyAssignmentCard
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          eventId={id}
          assignmentId={mine.id}
          roleName={mine.role_name}
          status={mine.status}
          arrivalTime={mine.arrival_time}
          itemsToBring={mine.items_to_bring}
          equipments={(equipByAssignment.get(mine.id) ?? []).map(
            (e) => e.name
          )}
          leaderName={
            (mine.leader as unknown as { full_name: string } | null)
              ?.full_name ?? null
          }
        />
      )}

      {event.description && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {event.script && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Roteiro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {event.script}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            Equipe escalada ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.isLeader ? (
            <AssignmentManager
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              eventId={id}
              assignments={rows}
              members={members}
              equipments={equipments}
            />
          ) : (
            <div className="space-y-2">
              {rows.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm"
                >
                  <span className="font-medium">{a.full_name}</span>
                  <span className="text-muted-foreground">{a.role_name}</span>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ninguém escalado ainda.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {tenant.isLeader && rows.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Avaliações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((a) => (
              <EvaluationPanel
                key={a.id}
                churchSlug={churchSlug}
                churchId={tenant.church.id}
                eventId={id}
                assignmentId={a.id}
                userId={a.user_id}
                fullName={a.full_name}
                existing={evaluations.get(a.id) ?? null}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
