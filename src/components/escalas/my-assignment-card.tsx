"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import {
  requestSubstitution,
  setAssignmentStatus,
} from "@/lib/actions/escalas";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function MyAssignmentCard({
  churchSlug,
  churchId,
  eventId,
  assignmentId,
  roleName,
  status,
  arrivalTime,
  itemsToBring,
  equipments,
  leaderName,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  assignmentId: string;
  roleName: string;
  status: string;
  arrivalTime: string | null;
  itemsToBring: string | null;
  equipments: string[];
  leaderName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  function confirm() {
    startTransition(async () => {
      const result = await setAssignmentStatus({
        churchSlug,
        eventId,
        assignmentId,
        status: "confirmado",
      });
      if (result && !result.ok) toast.error(result.error);
      else toast.success("Presença confirmada!");
    });
  }

  function substitute() {
    startTransition(async () => {
      const result = await requestSubstitution({
        churchSlug,
        churchId,
        eventId,
        assignmentId,
        reason,
      });
      if (result && !result.ok) toast.error(result.error);
      else {
        toast.success("Substituição solicitada");
        setShowReason(false);
      }
    });
  }

  return (
    <Card className="rounded-3xl border-2 border-foreground/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Sua escala</CardTitle>
          <Badge
            className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[status]}`}
          >
            {ASSIGNMENT_STATUS_LABELS[status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Função:</span>{" "}
            <span className="font-medium">{roleName}</span>
          </p>
          {arrivalTime && (
            <p>
              <span className="text-muted-foreground">Chegada:</span>{" "}
              <span className="font-medium">
                {new Date(arrivalTime).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          )}
          {leaderName && (
            <p>
              <span className="text-muted-foreground">Líder:</span>{" "}
              <span className="font-medium">{leaderName}</span>
            </p>
          )}
          {itemsToBring && (
            <p>
              <span className="text-muted-foreground">Levar:</span>{" "}
              <span className="font-medium">{itemsToBring}</span>
            </p>
          )}
          {equipments.length > 0 && (
            <div className="pt-1">
              <p className="text-muted-foreground">Equipamentos:</p>
              <ul className="mt-1 space-y-1">
                {equipments.map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-muted px-3 py-2 font-medium"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(status === "convidado" || status === "substituicao_solicitada") && (
          <Button
            disabled={pending}
            onClick={confirm}
            className="h-12 w-full rounded-full text-base"
          >
            {pending ? "Confirmando…" : "Confirmar presença"}
          </Button>
        )}

        {(status === "convidado" || status === "confirmado") &&
          (showReason ? (
            <div className="space-y-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="h-11 rounded-full"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setShowReason(false)}
                  className="h-11 flex-1 rounded-full"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={substitute}
                  className="h-11 flex-1 rounded-full"
                >
                  Solicitar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setShowReason(true)}
              className="h-11 w-full rounded-full"
            >
              Solicitar substituição
            </Button>
          ))}

        <a
          href={`/${churchSlug}/escalas/${eventId}/calendario`}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <CalendarPlus className="size-4" />
          Adicionar ao meu calendário
        </a>
      </CardContent>
    </Card>
  );
}
