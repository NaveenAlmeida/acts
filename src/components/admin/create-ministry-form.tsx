"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createMinistry } from "@/lib/actions/pessoas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateMinistryForm({
  churchSlug,
  churchId,
}: {
  churchSlug: string;
  churchId: string;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMinistry({
        churchSlug,
        churchId,
        name: formData.get("name"),
      });
      if (result && !result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Ministério criado");
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <form action={onSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        name="name"
        placeholder="Ex.: Mídia, Louvor, Recepção…"
        required
        className="h-12 rounded-full"
      />
      <Button type="submit" disabled={pending} className="h-12 rounded-full">
        {pending ? "Criando…" : "Criar"}
      </Button>
    </form>
  );
}
