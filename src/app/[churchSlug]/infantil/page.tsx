import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, ChevronRight, TriangleAlert } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry, formatAge, suggestClass, type ChildClass } from "@/lib/infantil";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SeedClassesButton } from "@/components/infantil/seed-classes-button";

export default async function InfantilPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);

  if (!ministry) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Infantil</h1>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Setor Infantil ainda não existe</CardTitle>
            <CardDescription>
              Crie um ministério chamado &quot;Infantil&quot; na Administração para
              ativar o módulo. Os dados das crianças ficam isolados nesse setor.
            </CardDescription>
          </CardHeader>
          {tenant.isCoord && (
            <CardContent>
              <Button
                nativeButton={false}
                className="h-11 rounded-full"
                render={<Link href={`/${churchSlug}/admin`} />}
              >
                Ir para Administração
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  // acesso: quem serve no Infantil, ou a coordenação da igreja
  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  if (!vinculo && !tenant.isCoord) redirect(`/${churchSlug}`);
  const podeGerir =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";

  const [{ data: classes }, { data: children }, { data: eventos }] = await Promise.all([
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
      .from("events")
      .select("id, title, starts_at")
      .eq("church_id", tenant.church.id)
      .gte("starts_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order("starts_at")
      .limit(3),
  ]);

  const turmas = (classes ?? []) as ChildClass[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Infantil</h1>
        <p className="text-muted-foreground">
          {children?.length ?? 0}{" "}
          {(children?.length ?? 0) === 1 ? "criança cadastrada" : "crianças cadastradas"}
        </p>
      </div>

      {turmas.length === 0 && podeGerir && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Criar as turmas</CardTitle>
            <CardDescription>
              Comece com as faixas etárias padrão (Berçário, Maternal, Jardim,
              Primários, Juniores). Você pode ajustar depois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeedClassesButton churchSlug={churchSlug} ministryId={ministry.id} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Sessões</CardTitle>
          <CardDescription>Faça o check-in das crianças no culto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(eventos ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/${churchSlug}/infantil/sessao/${e.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDate(e.starts_at)} · {formatEventTime(e.starts_at)}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {(eventos ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum culto próximo. Crie um evento em Escalas.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Crianças</CardTitle>
            <CardDescription>Fichas do setor</CardDescription>
          </div>
          {podeGerir && (
            <Button
              nativeButton={false}
              className="h-10 shrink-0 rounded-full px-4"
              render={<Link href={`/${churchSlug}/infantil/nova`} />}
            >
              + Cadastrar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(children ?? []).map((c) => {
            const turma = suggestClass(c.birth_date, turmas);
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Baby className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAge(c.birth_date)}
                    {turma ? ` · ${turma.name}` : ""}
                  </p>
                </div>
                {c.allergies && (
                  <Badge className="shrink-0 rounded-full border-0 bg-amber-100 text-amber-800">
                    <TriangleAlert className="mr-1 size-3" />
                    Alergia
                  </Badge>
                )}
              </div>
            );
          })}
          {(children ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma criança cadastrada ainda.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Dados de menores: visíveis apenas a quem serve no Infantil e à
        coordenação da igreja.
      </p>
    </div>
  );
}
