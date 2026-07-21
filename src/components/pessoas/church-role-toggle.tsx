"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setChurchRole } from "@/lib/actions/pessoas";
import { cn } from "@/lib/utils";

type ChurchRole = "admin" | "coordenador" | "member";

const ROLES: { value: ChurchRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Controle total, incluindo apagar a igreja" },
  {
    value: "coordenador",
    label: "Coordenador",
    desc: "Gerencia toda a operação, sem renomear/apagar a igreja",
  },
  { value: "member", label: "Membro", desc: "Acesso comum" },
];

export function ChurchRoleToggle({
  churchSlug,
  churchId,
  userId,
  currentRole,
  isSelf,
}: {
  churchSlug: string;
  churchId: string;
  userId: string;
  currentRole: ChurchRole;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function setRole(role: ChurchRole) {
    if (role === currentRole) return;
    startTransition(async () => {
      const result = await setChurchRole({ churchSlug, churchId, userId, role });
      if (result && !result.ok) toast.error(result.error);
      else toast.success(`Papel atualizado para ${role}`);
    });
  }

  if (isSelf) {
    return (
      <p className="text-sm text-muted-foreground">
        Você não pode alterar o seu próprio papel de igreja.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ROLES.map((r) => {
        const active = r.value === currentRole;
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => setRole(r.value)}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:border-foreground/40"
            )}
          >
            <span>
              <span className="block font-medium">{r.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  active ? "text-background/80" : "text-muted-foreground"
                )}
              >
                {r.desc}
              </span>
            </span>
            {active && <span className="text-xs font-medium">Atual</span>}
          </button>
        );
      })}
    </div>
  );
}
