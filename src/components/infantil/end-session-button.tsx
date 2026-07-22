"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encerrarSessao } from "@/lib/actions/infantil";

export function EndSessionButton({
  churchSlug,
  churchId,
  ministryId,
  eventId,
  presentes,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
  presentes: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (presentes === 0) return null;

  if (!confirmando) {
    return (
      <Button
        variant="outline"
        className="h-11 w-full rounded-full"
        onClick={() => setConfirmando(true)}
      >
        <Megaphone className="size-4" />
        Encerrar e avisar os responsáveis
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed p-4">
      <p className="text-sm">
        Avisar os responsáveis das{" "}
        <strong>
          {presentes} {presentes === 1 ? "criança" : "crianças"}
        </strong>{" "}
        que ainda estão na sala?
      </p>
      <div className="flex gap-2">
        <Button
          disabled={pending}
          className="h-10 flex-1 rounded-full"
          onClick={() =>
            startTransition(async () => {
              const r = await encerrarSessao({
                churchSlug,
                churchId,
                ministryId,
                eventId,
              });
              if (r.ok) {
                toast.success("Responsáveis avisados");
                setConfirmando(false);
              } else {
                toast.error(r.error);
              }
            })
          }
        >
          {pending ? "Avisando…" : "Avisar todos"}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="h-10 rounded-full"
          onClick={() => setConfirmando(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
