import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry, formatAge, suggestClass, type ChildClass } from "@/lib/infantil";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SessionChildRow,
  type Guardian,
  type SessionChild,
} from "@/components/infantil/session-child";
import { EndSessionButton } from "@/components/infantil/end-session-button";

export default async function SessaoInfantilPage({
  params,
}: {
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  if (!vinculo && !tenant.isCoord) redirect(`/${churchSlug}`);
  const podeLiberar =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";

  const [{ data: event }, { data: classes }, { data: children }, { data: checkins }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, starts_at")
        .eq("id", eventId)
        .eq("church_id", tenant.church.id)
        .maybeSingle(),
      supabase
        .from("child_classes")
        .select("id, name, min_age_months, max_age_months")
        .eq("ministry_id", ministry.id)
        .order("sort_order"),
      supabase
        .from("children")
        .select("id, full_name, birth_date, allergies, special_needs")
        .eq("ministry_id", ministry.id)
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("child_checkins")
        .select("id, child_id, code, checked_out_at")
        .eq("event_id", eventId),
    ]);

  if (!event) notFound();

  // autorizações de retirada de todas as crianças do setor
  const { data: vinculos } = await supabase
    .from("child_guardians")
    .select("child_id, can_pickup, relationship, guardians!inner(id, full_name)")
    .in("child_id", (children ?? []).map((c) => c.id));

  const guardiansByChild = new Map<string, Guardian[]>();
  for (const v of vinculos ?? []) {
    const g = v.guardians as unknown as { id: string; full_name: string };
    guardiansByChild.set(v.child_id, [
      ...(guardiansByChild.get(v.child_id) ?? []),
      { id: g.id, name: g.full_name, canPickup: v.can_pickup, relationship: v.relationship },
    ]);
  }
  const checkinByChild = new Map(
    (checkins ?? []).map((k) => [
      k.child_id,
      { id: k.id, code: k.code, checkedOut: !!k.checked_out_at },
    ])
  );

  const turmas = (classes ?? []) as ChildClass[];
  const porTurma = new Map<string, SessionChild[]>();
  for (const c of children ?? []) {
    const turma = suggestClass(c.birth_date, turmas);
    const chave = turma?.name ?? "Sem turma";
    const item: SessionChild = {
      id: c.id,
      fullName: c.full_name,
      age: formatAge(c.birth_date),
      allergies: c.allergies,
      specialNeeds: c.special_needs,
      classId: turma?.id ?? null,
      checkin: checkinByChild.get(c.id) ?? null,
      guardians: guardiansByChild.get(c.id) ?? [],
    };
    porTurma.set(chave, [...(porTurma.get(chave) ?? []), item]);
  }

  const presentes = (checkins ?? []).filter((k) => !k.checked_out_at).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Infantil · {formatEventDate(event.starts_at)} ·{" "}
          {formatEventTime(event.starts_at)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-muted-foreground">
          {presentes} {presentes === 1 ? "criança presente" : "crianças presentes"}
        </p>
      </div>

      <EndSessionButton
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        eventId={eventId}
        presentes={presentes}
      />

      {[...porTurma.entries()].map(([turma, itens]) => (
        <Card key={turma} className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">{turma}</CardTitle>
            <CardDescription>
              {itens.length} {itens.length === 1 ? "criança" : "crianças"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {itens.map((c) => (
              <SessionChildRow
                key={c.id}
                child={c}
                churchSlug={churchSlug}
                churchId={tenant.church.id}
                ministryId={ministry.id}
                eventId={eventId}
                podeLiberar={podeLiberar}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {(children ?? []).length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Nenhuma criança cadastrada. Cadastre na tela do Infantil.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        A criança só sai com responsável autorizado. Exceções exigem justificativa
        e ficam registradas.
      </p>
    </div>
  );
}
