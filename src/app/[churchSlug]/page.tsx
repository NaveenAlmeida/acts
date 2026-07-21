import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { checkPlatformAdmin } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
  formatEventDate,
  formatEventTime,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickConfirm } from "@/components/escalas/quick-confirm";

export default async function HomePage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const isPlatformAdmin = await checkPlatformAdmin();

  const supabase = await createClient();
  const { data: myEscalas } = await supabase
    .from("assignments")
    .select("id, role_name, status, events!inner(id, title, starts_at)")
    .eq("church_id", tenant.church.id)
    .eq("user_id", tenant.userId)
    .gte("events.starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true, referencedTable: "events" })
    .limit(3);

  const escalas = myEscalas ?? [];
  const upcomingCount = escalas.length;
  const isAdmin = tenant.role === "admin";
  const canAdmin = tenant.isCoord;
  const showManage = canAdmin || tenant.isLeader;

  return (
    <div className="flex flex-col gap-9 pt-2">
      {/* Cabeçalho — mais presença e um subtítulo vivo com dado real */}
      <header className="space-y-1.5 px-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          {tenant.church.name}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {upcomingCount > 0
            ? `Você serve em ${upcomingCount} ${
                upcomingCount === 1 ? "escala" : "escalas"
              } em breve`
            : "Nenhuma escala agendada por enquanto"}
        </p>
      </header>

      {isPlatformAdmin && (
        <Link href="/painel" className="block active:scale-[0.99] transition-transform">
          <Card className="rounded-3xl border-0 bg-foreground text-background ring-0">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background/15">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Painel da Plataforma</p>
                <p className="text-sm text-background/70">
                  Todas as igrejas, equipes e logs
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-background/60" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Agenda */}
      <section className="space-y-3">
        <h2 className="px-2 text-sm font-medium text-muted-foreground">
          Sua agenda
        </h2>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Próximas escalas</CardTitle>
            <CardDescription>Onde você vai servir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {escalas.map((a) => {
              const ev = a.events as unknown as {
                id: string;
                title: string;
                starts_at: string;
              };
              const pendente = a.status === "convidado";
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3.5"
                >
                  <Link
                    href={`/${churchSlug}/escalas/${ev.id}`}
                    className="min-w-0 flex-1 transition-opacity hover:opacity-70"
                  >
                    <p className="truncate font-medium">{ev.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatEventDate(ev.starts_at)} ·{" "}
                      {formatEventTime(ev.starts_at)} · {a.role_name}
                    </p>
                  </Link>
                  {pendente ? (
                    <QuickConfirm
                      churchSlug={churchSlug}
                      eventId={ev.id}
                      assignmentId={a.id}
                    />
                  ) : (
                    <Badge
                      className={`shrink-0 rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[a.status]}`}
                    >
                      {ASSIGNMENT_STATUS_LABELS[a.status]}
                    </Badge>
                  )}
                </div>
              );
            })}
            {upcomingCount === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhuma escala por enquanto.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Gerenciar — os links viram uma lista agrupada (menos cards soltos) */}
      {showManage && (
        <section className="space-y-3">
          <h2 className="px-2 text-sm font-medium text-muted-foreground">
            Gerenciar
          </h2>
          <Card className="rounded-3xl py-0">
            <div className="divide-y divide-border/60">
              {isAdmin && (
                <NavRow
                  href={`/${churchSlug}/guia`}
                  icon={<BookOpen className="size-5" />}
                  title="Guia de uso"
                  description="Monte sua igreja do zero, passo a passo"
                />
              )}
              {tenant.isLeader && (
                <NavRow
                  href={`/${churchSlug}/pessoas`}
                  icon={<Users className="size-5" />}
                  title="Equipe"
                  description="Perfis, aptidões e ministérios"
                />
              )}
              {tenant.isLeader && (
                <NavRow
                  href={`/${churchSlug}/distribuicao`}
                  icon={<BarChart3 className="size-5" />}
                  title="Distribuição de escalas"
                  description="Quem está sobrecarregado ou de fora"
                />
              )}
              {canAdmin && (
                <NavRow
                  href={`/${churchSlug}/admin`}
                  icon={<Settings className="size-5" />}
                  title="Administração"
                  description="Ministérios e configurações"
                />
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Convite */}
      {isAdmin && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Convide sua equipe</CardTitle>
            <CardDescription>
              Compartilhe o código de convite da igreja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-2xl bg-muted px-4 py-4 text-center font-mono text-xl tracking-[0.3em]">
              {tenant.church.invite_code}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NavRow({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-accent/50 active:bg-accent"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground/80">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
