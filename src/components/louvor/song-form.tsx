"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSong } from "@/lib/actions/louvor";

export function SongForm({
  churchSlug,
  churchId,
}: {
  churchSlug: string;
  churchId: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar(form: FormData) {
    setErro(null);
    startTransition(async () => {
      const r = await createSong({
        churchSlug,
        churchId,
        title: String(form.get("title") ?? ""),
        artist: String(form.get("artist") ?? ""),
        defaultKey: String(form.get("defaultKey") ?? ""),
        bpm: form.get("bpm") ? Number(form.get("bpm")) : undefined,
        lyrics: String(form.get("lyrics") ?? ""),
        link: String(form.get("link") ?? ""),
      });
      if (!r.ok) setErro(r.error ?? "Não deu certo");
      else setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <Button className="h-11 rounded-full" onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Cadastrar música
      </Button>
    );
  }

  return (
    <form action={salvar} className="space-y-3">
      <Input name="title" placeholder="Nome da música" required className="h-11 rounded-2xl" />
      <Input name="artist" placeholder="Artista (opcional)" className="h-11 rounded-2xl" />
      <div className="flex gap-2">
        <Input name="defaultKey" placeholder="Tom (G)" className="h-11 rounded-2xl" />
        <Input name="bpm" type="number" placeholder="BPM" className="h-11 rounded-2xl" />
      </div>
      <Input name="link" placeholder="Link do YouTube ou cifra (opcional)" className="h-11 rounded-2xl" />
      <textarea
        name="lyrics"
        placeholder="Letra — é o que a equipe lê para ensaiar"
        rows={8}
        className="w-full rounded-xl border bg-background p-3 text-base md:text-sm"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-11 rounded-full">
          {pending ? "Salvando…" : "Salvar no acervo"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-full"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
