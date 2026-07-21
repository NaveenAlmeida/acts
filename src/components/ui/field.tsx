"use client";

import { cloneElement, useId } from "react";
import type { ReactElement } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Rótulo + controle associados via `useId` (WCAG 1.3.1/4.1.2).
 * Injeta o `id` no único filho (Input, select ou textarea), então o
 * `<label htmlFor>` aponta para o campo — leitor de tela anuncia o rótulo
 * e tocar no texto foca o campo.
 */
export function Field({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  className?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {cloneElement(children, { id })}
    </div>
  );
}
