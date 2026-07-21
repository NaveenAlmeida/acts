import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const WINDOW_PAST_DAYS = 90;
const WINDOW_FUTURE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DistribuicaoPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  // ferramenta de liderança: admin, coordenador, gerente ou líder de ministério
  if (!tenant.isLeader) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const cid = tenant.church.id;
  const from = new Date(Date.now() - WINDOW_PAST_DAYS * DAY_MS).toISOString();
  const to = new Date(Date.now() + WINDOW_FUTURE_DAYS * DAY_MS).toISOString();

  const [{ data: roster }, { data: assignments }] = await Promise.all([
    supabase
      .from("church_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", cid)
      .eq("status", "active"),
    supabase
      .from("assignments")
      .select("user_id, events!inner(starts_at)")
      .eq("church_id", cid)
      .gte("events.starts_at", from)
      .lte("events.starts_at", to),
  ]);

  const counts = new Map<string, number>();
  for (const a of assignments ?? []) {
    counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
  }

  const people = (roster ?? [])
    .map((m) => ({
      userId: m.user_id,
      name:
        (m.profiles as unknown as { full_name: string }).full_name?.trim() ||
        "Sem nome",
      count: counts.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

  const total = assignments?.length ?? 0;
  const n = people.length || 1;
  const avg = total / n;
  const max = Math.max(1, ...people.map((p) => p.count));
  // sobrecarga: bem acima da média, com um piso p/ não sinalizar em amostra pequena
  const overloadThreshold = Math.max(3, avg * 1.5);
  const idle = people.filter((p) => p.count === 0).length;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Distribuição de escalas
        </h1>
        <p className="text-muted-foreground">
          Como o serviço está dividido — últimos {WINDOW_PAST_DAYS} dias e
          próximas semanas
        </p>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="grid grid-cols-3 gap-2 py-6 text-center">
          <div>
            <p className="text-2xl font-semibold">{total}</p>
            <p className="text-xs text-muted-foreground">escalações</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{people.length}</p>
            <p className="text-xs text-muted-foreground">pessoas</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{avg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">média/pessoa</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Carga por pessoa</CardTitle>
          <CardDescription>
            {idle > 0
              ? `${idle} ${idle === 1 ? "pessoa ainda não foi escalada" : "pessoas ainda não foram escaladas"} neste período — candidatas a entrar na próxima.`
              : "Todos participaram neste período."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {people.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum membro ativo ainda.
            </p>
          )}
          {people.map((p) => {
            const overloaded = p.count >= overloadThreshold;
            const width = Math.round((p.count / max) * 100);
            return (
              <div key={p.userId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                      {initials(p.name)}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {overloaded && (
                      <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Sobrecarregado
                      </Badge>
                    )}
                    {p.count === 0 && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-muted-foreground"
                      >
                        Ocioso
                      </Badge>
                    )}
                    <span className="w-6 text-right text-sm font-semibold tabular-nums">
                      {p.count}
                    </span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${overloaded ? "bg-amber-400" : "bg-foreground"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Conta cada função escalada por evento na janela. Use para revezar melhor
        e trazer quem está de fora.
      </p>
    </div>
  );
}
