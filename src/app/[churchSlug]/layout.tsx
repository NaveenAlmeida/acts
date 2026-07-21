import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { SectorSwitcher } from "@/components/shell/sector-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SessionKeeper } from "@/components/shell/session-keeper";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active, options } = await getActiveMinistry(churchSlug);

  // escalas aguardando confirmação (status 'convidado', evento futuro) —
  // alimenta o aviso in-app (badge no ícone Escalas)
  const supabase = await createClient();
  const { count: escalasPending } = await supabase
    .from("assignments")
    .select("id, events!inner(starts_at)", { count: "exact", head: true })
    .eq("user_id", tenant.userId)
    .eq("church_id", tenant.church.id)
    .eq("status", "convidado")
    .gte("events.starts_at", new Date().toISOString());

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const initials = tenant.profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <SessionKeeper />
      <Sidebar
        churchSlug={churchSlug}
        churchName={tenant.church.name}
        canAdmin={tenant.isCoord}
        isLeader={tenant.isLeader}
        escalasPending={escalasPending ?? 0}
      />
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b border-transparent bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] md:px-8">
            <Avatar className="size-10">
              <AvatarImage src={tenant.profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[11px] font-medium capitalize leading-tight text-muted-foreground">
                {today}
              </p>
              <p className="truncate text-sm font-semibold leading-tight">
                {tenant.profile.full_name}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {active && (
                <SectorSwitcher
                  churchSlug={churchSlug}
                  activeId={active.id}
                  options={options}
                />
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-4 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
      <BottomNav
        churchSlug={churchSlug}
        isLeader={tenant.isLeader}
        escalasPending={escalasPending ?? 0}
      />
    </div>
  );
}
