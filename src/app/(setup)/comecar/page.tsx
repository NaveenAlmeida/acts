"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createChurch, joinChurch } from "@/lib/actions/church";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ComecarPage() {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"join" | "create">("join");

  function submit(action: typeof createChurch, formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm space-y-4">
        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {mode === "join" ? "Entrar em uma igreja" : "Criar sua igreja"}
            </CardTitle>
            <CardDescription>
              {mode === "join"
                ? "Peça o código de convite ao seu líder"
                : "Você será o administrador"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "join" ? (
              <form
                action={(fd) => submit(joinChurch, fd)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Código de convite</Label>
                  <Input
                    id="inviteCode"
                    name="inviteCode"
                    required
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-12 rounded-full text-center font-mono tracking-widest"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-12 w-full rounded-full text-base"
                >
                  {pending ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            ) : (
              <form
                action={(fd) => submit(createChurch, fd)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da igreja</Label>
                  <Input id="name" name="name" required className="h-12 rounded-full" />
                </div>
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-12 w-full rounded-full text-base"
                >
                  {pending ? "Criando…" : "Criar igreja"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <button
          type="button"
          onClick={() => setMode(mode === "join" ? "create" : "join")}
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "join"
            ? "Ou crie uma nova igreja"
            : "Ou entre com um código de convite"}
        </button>
      </div>
    </main>
  );
}
