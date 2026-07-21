"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AREAS_CONHECIMENTO,
  DIAS_SEMANA,
  NIVEIS,
  PERIODOS,
  type BriefingAnswers,
} from "@/lib/briefing";
import { skipBriefing, submitBriefing } from "@/lib/actions/briefing";
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
import { cn } from "@/lib/utils";

type Skill = { slug: string; name: string };

const TOTAL_STEPS = 5;

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/40"
      )}
    >
      {children}
    </button>
  );
}

export function OnboardingWizard({ skills }: { skills: Skill[] }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const firstRender = useRef(true);

  // ao trocar de passo, move o foco para o título — leitor de tela e
  // usuário de teclado percebem que o conteúdo mudou (WCAG 2.4.3)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById(headingId)?.focus();
  }, [step, headingId]);
  const [a, setA] = useState<BriefingAnswers>({
    comoConheceu: "",
    jaServiu: false,
    profissao: "",
    cursos: "",
    softwares: "",
    equipamentosConhece: "",
    experiencia: [],
    interesses: [],
    conhecimentos: {},
    maiorDificuldade: "",
    maiorObjetivo: "",
    comoCrescer: "",
    dias: [],
    periodos: [],
    tempoDisponivel: "",
  });

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  // functional updates: seguros mesmo com vários eventos no mesmo tick
  function patch(p: Partial<BriefingAnswers>) {
    setA((prev) => ({ ...prev, ...p }));
  }

  function toggleField(field: "experiencia" | "interesses" | "dias" | "periodos", value: string) {
    setA((prev) => ({ ...prev, [field]: toggle(prev[field], value) }));
  }

  function setNivel(key: string, nivel: number) {
    setA((prev) => ({
      ...prev,
      conhecimentos: { ...prev.conhecimentos, [key]: nivel },
    }));
  }

  function finish() {
    startTransition(async () => {
      const result = await submitBriefing(a);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  function pular() {
    startTransition(async () => {
      const result = await skipBriefing();
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const titles = [
    ["Sobre você", "Nos conte um pouco da sua história"],
    ["Sua experiência", "O que você já sabe fazer"],
    ["Seus conhecimentos", "Avalie seu nível em cada área"],
    ["Seus interesses", "Onde você quer chegar"],
    ["Disponibilidade", "Quando você pode servir"],
  ][step];

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-6 bg-foreground" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>

      <div aria-live="polite" className="sr-only">
        Passo {step + 1} de {TOTAL_STEPS}: {titles[0]}
      </div>

      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle
            id={headingId}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {titles[0]}
          </CardTitle>
          <CardDescription>{titles[1]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="profissao">Qual a sua profissão?</Label>
                <Input
                  id="profissao"
                  value={a.profissao}
                  onChange={(e) => patch({ profissao: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comoConheceu">Como conheceu a igreja?</Label>
                <Input
                  id="comoConheceu"
                  value={a.comoConheceu}
                  onChange={(e) => patch({ comoConheceu: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Já serviu em algum ministério?</Label>
                <div className="flex gap-2">
                  <Chip
                    selected={a.jaServiu}
                    onClick={() => patch({ jaServiu: true })}
                  >
                    Sim
                  </Chip>
                  <Chip
                    selected={!a.jaServiu}
                    onClick={() => patch({ jaServiu: false })}
                  >
                    Não
                  </Chip>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Em quais áreas você já tem experiência?</Label>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Chip
                      key={s.slug}
                      selected={a.experiencia.includes(s.slug)}
                      onClick={() =>
                        toggleField("experiencia", s.slug)
                      }
                    >
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipamentos">Quais equipamentos você conhece?</Label>
                <Input
                  id="equipamentos"
                  placeholder="Ex.: Canon R8, mesa de som Behringer…"
                  value={a.equipamentosConhece}
                  onChange={(e) =>
                    patch({ equipamentosConhece: e.target.value })
                  }
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="softwares">Softwares que domina</Label>
                <Input
                  id="softwares"
                  placeholder="Ex.: Premiere, Photoshop, OBS…"
                  value={a.softwares}
                  onChange={(e) => patch({ softwares: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cursos">Cursos que já realizou</Label>
                <Input
                  id="cursos"
                  value={a.cursos}
                  onChange={(e) => patch({ cursos: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {AREAS_CONHECIMENTO.map((area) => (
                <div key={area.key} className="space-y-2">
                  <Label>{area.label}</Label>
                  <div className="flex flex-wrap gap-2">
                    {NIVEIS.map((nivel, i) => (
                      <Chip
                        key={nivel}
                        selected={(a.conhecimentos[area.key] ?? 0) === i}
                        onClick={() => setNivel(area.key, i)}
                      >
                        {nivel}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Quais áreas deseja aprender?</Label>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Chip
                      key={s.slug}
                      selected={a.interesses.includes(s.slug)}
                      onClick={() =>
                        toggleField("interesses", s.slug)
                      }
                    >
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dificuldade">Sua maior dificuldade hoje</Label>
                <Input
                  id="dificuldade"
                  value={a.maiorDificuldade}
                  onChange={(e) =>
                    patch({ maiorDificuldade: e.target.value })
                  }
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objetivo">Seu maior objetivo</Label>
                <Input
                  id="objetivo"
                  value={a.maiorObjetivo}
                  onChange={(e) => patch({ maiorObjetivo: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crescer">Como deseja crescer no ministério?</Label>
                <Input
                  id="crescer"
                  value={a.comoCrescer}
                  onChange={(e) => patch({ comoCrescer: e.target.value })}
                  className="h-12 rounded-full"
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Dias disponíveis</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((d) => (
                    <Chip
                      key={d.key}
                      selected={a.dias.includes(d.key)}
                      onClick={() => toggleField("dias", d.key)}
                    >
                      {d.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Períodos</Label>
                <div className="flex flex-wrap gap-2">
                  {PERIODOS.map((p) => (
                    <Chip
                      key={p.key}
                      selected={a.periodos.includes(p.key)}
                      onClick={() =>
                        toggleField("periodos", p.key)
                      }
                    >
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempo">Quanto tempo você tem disponível?</Label>
                <Input
                  id="tempo"
                  placeholder="Ex.: 2 cultos por semana"
                  value={a.tempoDisponivel}
                  onChange={(e) =>
                    patch({ tempoDisponivel: e.target.value })
                  }
                  className="h-12 rounded-full"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="h-12 flex-1 rounded-full"
              >
                Voltar
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                className="h-12 flex-1 rounded-full"
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="button"
                disabled={pending}
                onClick={finish}
                className="h-12 flex-1 rounded-full"
              >
                {pending ? "Salvando…" : "Concluir"}
              </Button>
            )}
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={pular}
            className="min-h-11 w-full text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            Pular por agora
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
