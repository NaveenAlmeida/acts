"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { setAssignmentStatus } from "@/lib/actions/escalas";
import { Button } from "@/components/ui/button";

/**
 * Confirma presença numa escala com um toque, direto da Home — sem
 * precisar abrir o detalhe do evento. Fecha o loop do aviso in-app
 * (badge de escala pendente → confirmar aqui mesmo).
 */
export function QuickConfirm({
  churchSlug,
  eventId,
  assignmentId,
}: {
  churchSlug: string;
  eventId: string;
  assignmentId: string;
}) {
  const [pending, startTransition] = useTransition();

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

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={confirm}
      className="h-9 shrink-0 rounded-full px-4"
    >
      <Check className="size-4" />
      {pending ? "…" : "Confirmar"}
    </Button>
  );
}
