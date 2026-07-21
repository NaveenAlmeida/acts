"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // registra no console para diagnóstico; não expõe detalhes ao usuário
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Card className="w-full max-w-sm rounded-3xl">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Ops, algo não carregou
          </h1>
          <p className="text-sm text-muted-foreground">
            Pode ter sido a conexão. Tente novamente — seus dados estão salvos.
          </p>
          <Button
            onClick={reset}
            className="h-12 w-full rounded-full text-base"
          >
            <RotateCcw className="size-4" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
