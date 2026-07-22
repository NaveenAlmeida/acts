"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rotuloUltimaVez, type Song } from "@/lib/louvor";
import { addToSetlist } from "@/lib/actions/louvor";

type SongComHistorico = Song & { ultimaVez: string | null };

type Props = {
  churchSlug: string;
  churchId: string;
  eventId: string;
  acervo: SongComHistorico[];
  /** já estão na sequência — não oferecer de novo */
  jaEscolhidas: string[];
};

export function AddToSetlist({
  churchSlug,
  churchId,
  eventId,
  acervo,
  jaEscolhidas,
}: Props) {
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const disponiveis = useMemo(() => {
    const escolhidas = new Set(jaEscolhidas);
    const termo = busca.trim().toLowerCase();
    return acervo
      .filter((s) => !escolhidas.has(s.id))
      .filter(
        (s) =>
          !termo ||
          s.title.toLowerCase().includes(termo) ||
          (s.artist ?? "").toLowerCase().includes(termo)
      )
      .slice(0, 8);
  }, [acervo, jaEscolhidas, busca]);

  function adicionar(songId: string) {
    setErro(null);
    startTransition(async () => {
      const r = await addToSetlist({ churchSlug, churchId, eventId, songId });
      if (!r.ok) setErro(r.error ?? "Não deu certo");
      else setBusca("");
    });
  }

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar no acervo…"
        className="h-11 rounded-full"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="space-y-1">
        {disponiveis.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{s.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {s.artist}
                {s.artist ? " · " : ""}
                {/* evita repetir demais ou sumir com uma música boa */}
                {rotuloUltimaVez(s.ultimaVez)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => adicionar(s.id)}
              aria-label={`Adicionar ${s.title}`}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ))}
        {disponiveis.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {acervo.length === 0
              ? "O acervo está vazio — cadastre as músicas na página do Louvor."
              : "Nenhuma música encontrada."}
          </p>
        )}
      </div>
    </div>
  );
}
