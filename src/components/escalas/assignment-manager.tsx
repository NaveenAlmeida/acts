"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  addAssignment,
  linkEquipment,
  removeAssignment,
  setAssignmentStatus,
  unlinkEquipment,
} from "@/lib/actions/escalas";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = {
  user_id: string;
  full_name: string;
  cargaMes: number;
  indisponivel: boolean;
  aptidoes: string[];
  interesses: string[];
};
type Equipment = { id: string; name: string };
export type AssignmentRow = {
  id: string;
  user_id: string;
  full_name: string;
  role_name: string;
  status: string;
  equipments: { id: string; name: string }[];
};

export function AssignmentManager({
  churchSlug,
  churchId,
  eventId,
  assignments,
  members,
  equipments,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  assignments: AssignmentRow[];
  members: Member[];
  equipments: Equipment[];
}) {
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [roleName, setRoleName] = useState("");

  function act(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.error ?? "Erro");
    });
  }

  function escalar() {
    if (!userId) return toast.error("Escolha a pessoa");
    if (roleName.length < 2) return toast.error("Informe a função (ex.: Fotógrafo)");
    act(() =>
      addAssignment({ churchSlug, churchId, eventId, userId, roleName })
    );
    setUserId("");
    setRoleName("");
  }

  const selectCls =
    "h-11 rounded-xl border bg-background px-3 text-base md:text-sm";

  const selecionado = members.find((m) => m.user_id === userId);

  // status da escala num olhar (para o líder agir a tempo)
  const confirmados = assignments.filter((a) => a.status === "confirmado").length;
  const aguardando = assignments.filter((a) => a.status === "convidado").length;
  const trocas = assignments.filter(
    (a) => a.status === "substituicao_solicitada"
  ).length;

  return (
    <div className="space-y-4">
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            {confirmados} confirmado{confirmados === 1 ? "" : "s"}
          </span>
          {aguardando > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-700 dark:text-amber-400">
              {aguardando} aguardando
            </span>
          )}
          {trocas > 0 && (
            <span className="rounded-full bg-purple-500/15 px-3 py-1 font-medium text-purple-700 dark:text-purple-400">
              {trocas} pedindo troca
            </span>
          )}
        </div>
      )}
      <div className="space-y-3">
        {assignments.map((a) => (
          <div key={a.id} className="space-y-2 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.full_name}</p>
                <p className="text-sm text-muted-foreground">{a.role_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[a.status]}`}
                >
                  {ASSIGNMENT_STATUS_LABELS[a.status]}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  className="size-11 rounded-full text-muted-foreground"
                  aria-label={`Remover ${a.full_name}`}
                  onClick={() =>
                    act(() =>
                      removeAssignment({
                        churchSlug,
                        eventId,
                        assignmentId: a.id,
                      })
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {a.equipments.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  disabled={pending}
                  title="Remover equipamento"
                  onClick={() =>
                    act(() =>
                      unlinkEquipment({
                        churchSlug,
                        churchId,
                        eventId,
                        assignmentId: a.id,
                        equipmentId: eq.id,
                      })
                    )
                  }
                  className="rounded-full bg-muted px-3 py-2 text-xs font-medium hover:bg-muted/70"
                >
                  {eq.name} ×
                </button>
              ))}
              <select
                value=""
                disabled={pending}
                onChange={(e) =>
                  e.target.value &&
                  act(() =>
                    linkEquipment({
                      churchSlug,
                      churchId,
                      eventId,
                      assignmentId: a.id,
                      equipmentId: e.target.value,
                    })
                  )
                }
                className="h-9 rounded-full border bg-background px-3 text-sm"
                aria-label={`Vincular equipamento a ${a.full_name}`}
              >
                <option value="">+ equipamento</option>
                {equipments
                  .filter((eq) => !a.equipments.some((x) => x.id === eq.id))
                  .map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2">
              <select
                value={a.status}
                disabled={pending}
                onChange={(e) =>
                  act(() =>
                    setAssignmentStatus({
                      churchSlug,
                      eventId,
                      assignmentId: a.id,
                      status: e.target.value,
                    })
                  )
                }
                className={selectCls}
                aria-label={`Status de ${a.full_name}`}
              >
                {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ninguém escalado ainda.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-dashed p-4">
        <p className="text-sm font-medium">Escalar pessoa</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`${selectCls} sm:flex-1`}
            aria-label="Escolher pessoa"
          >
            <option value="">Escolher pessoa…</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
                {m.indisponivel ? " · indisponível" : ""}
                {m.cargaMes > 0 ? ` · ${m.cargaMes}× no mês` : ""}
              </option>
            ))}
          </select>
          <Input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="Função (ex.: Fotógrafo)"
            className="h-11 rounded-xl sm:flex-1"
          />
          <Button
            disabled={pending}
            className="h-11 rounded-full px-5"
            onClick={escalar}
          >
            Escalar
          </Button>
        </div>

        {selecionado && (
          <div className="space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">
                {selecionado.cargaMes}× este mês
              </span>
              {selecionado.indisponivel && (
                <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 font-medium text-red-700 dark:text-red-400">
                  Indisponível nesta data
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Sabe: </span>
              {selecionado.aptidoes.length > 0 ? (
                selecionado.aptidoes.join(", ")
              ) : (
                <span className="text-muted-foreground">nenhuma aptidão</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Quer: </span>
              {selecionado.interesses.length > 0 ? (
                selecionado.interesses.join(", ")
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
