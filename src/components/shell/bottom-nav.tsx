"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Camera, Home, User, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  churchSlug,
  isLeader,
  escalasPending = 0,
}: {
  churchSlug: string;
  isLeader: boolean;
  escalasPending?: number;
}) {
  const pathname = usePathname();

  const items = [
    { href: "", label: "Início", icon: Home, badge: 0 },
    { href: "/escalas", label: "Escalas", icon: Calendar, badge: escalasPending },
    { href: "/equipamentos", label: "Equipamentos", icon: Camera, badge: 0 },
    ...(isLeader
      ? [
          { href: "/manutencoes", label: "Manutenções", icon: Wrench, badge: 0 },
          { href: "/pessoas", label: "Equipe", icon: Users, badge: 0 },
        ]
      : []),
    { href: "/perfil", label: "Perfil", icon: User, badge: 0 },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-3 md:hidden"
    >
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/90 p-1.5 shadow-lg shadow-zinc-950/20 backdrop-blur-xl">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const full = `/${churchSlug}${href}`;
          const active =
            href === "" ? pathname === full : pathname.startsWith(full);
          return (
            <Link
              key={label}
              href={full}
              aria-label={
                badge > 0 ? `${label} (${badge} pendente)` : label
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-12 items-center justify-center gap-1.5 rounded-full transition-all duration-300",
                active
                  ? "bg-white px-3.5 text-zinc-900 shadow-sm"
                  : "w-12 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon
                className="size-5 shrink-0"
                strokeWidth={active ? 2.2 : 1.8}
              />
              {badge > 0 && (
                <span
                  className={cn(
                    "absolute top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
                    active ? "right-2" : "right-1.5"
                  )}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {active && (
                <span className="text-xs font-medium whitespace-nowrap">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
