"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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

type Estado = "verificando" | "pronto" | "invalido";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [pending, startTransition] = useTransition();

  // o link do e-mail traz o token na URL; o client do Supabase o processa
  // ao carregar e estabelece a sessão de recuperação.
  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (ativo && session) setEstado("pronto");
    });

    // dá um tempo para o token ser processado antes de considerar inválido
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (ativo) setEstado(data.session ? "pronto" : "invalido");
    }, 2000);

    return () => {
      ativo = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  function submit() {
    if (senha.length < 8) {
      return toast.error("A senha precisa de pelo menos 8 caracteres");
    }
    if (senha !== confirma) {
      return toast.error("As senhas não coincidem");
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        console.error("updatePassword:", error);
        toast.error("Não foi possível atualizar. Peça um novo link.");
        return;
      }
      toast.success("Senha atualizada!");
      router.push("/");
    });
  }

  if (estado === "verificando") {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Verificando o link…</p>
        </CardContent>
      </Card>
    );
  }

  if (estado === "invalido") {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-muted-foreground">
            Peça um novo link para criar sua senha.
          </p>
          <Link href="/esqueci-senha" className="block">
            <Button className="h-12 w-full rounded-full text-base">
              Pedir novo link
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Criar nova senha
        </CardTitle>
        <CardDescription>Use pelo menos 8 caracteres</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-12 rounded-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirma">Repita a senha</Label>
          <Input
            id="confirma"
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            className="h-12 rounded-full"
          />
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="h-12 w-full rounded-full text-base"
        >
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </CardContent>
    </Card>
  );
}
