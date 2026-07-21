"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  createDepartment,
  deleteDepartment,
} from "@/lib/actions/departamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Department = { id: string; name: string };

export function DepartmentsManager({
  churchSlug,
  churchId,
  departments,
}: {
  churchSlug: string;
  churchId: string;
  departments: Department[];
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function add(formData: FormData) {
    startTransition(async () => {
      const result = await createDepartment({
        churchSlug,
        churchId,
        name: formData.get("name"),
      });
      if (result && !result.ok) toast.error(result.error);
      else if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove(departmentId: string) {
    startTransition(async () => {
      const result = await deleteDepartment({ churchSlug, departmentId });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <form action={add} className="flex gap-2">
        <Input
          ref={inputRef}
          name="name"
          placeholder="Ex.: UMADESP (Jovens), Crianças…"
          required
          className="h-11 flex-1 rounded-xl"
        />
        <Button type="submit" disabled={pending} className="h-11 rounded-full px-5">
          Adicionar
        </Button>
      </form>

      <div className="space-y-2">
        {departments.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-2xl border px-4 py-3"
          >
            <p className="font-medium">{d.name}</p>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              className="size-9 rounded-full text-muted-foreground"
              aria-label={`Remover ${d.name}`}
              onClick={() => remove(d.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum departamento ainda. Crie os seus (Jovens, Irmãs, Crianças,
            Culto oficial…) — ficam disponíveis ao montar as escalas.
          </p>
        )}
      </div>
    </div>
  );
}
