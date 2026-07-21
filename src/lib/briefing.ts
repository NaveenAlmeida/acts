import { z } from "zod";

export const NIVEIS = ["Nenhum", "Básico", "Intermediário", "Avançado"] as const;

export const AREAS_CONHECIMENTO = [
  { key: "fotografia", label: "Fotografia" },
  { key: "video", label: "Vídeo" },
  { key: "audio", label: "Áudio" },
  { key: "iluminacao", label: "Iluminação" },
  { key: "design", label: "Design" },
  { key: "transmissao", label: "Transmissão" },
] as const;

export const DIAS_SEMANA = [
  { key: "domingo", label: "Domingo" },
  { key: "segunda", label: "Segunda" },
  { key: "terca", label: "Terça" },
  { key: "quarta", label: "Quarta" },
  { key: "quinta", label: "Quinta" },
  { key: "sexta", label: "Sexta" },
  { key: "sabado", label: "Sábado" },
] as const;

export const PERIODOS = [
  { key: "manha", label: "Manhã" },
  { key: "tarde", label: "Tarde" },
  { key: "noite", label: "Noite" },
] as const;

export const briefingSchema = z.object({
  comoConheceu: z.string().max(500).default(""),
  jaServiu: z.boolean().default(false),
  profissao: z.string().max(120).default(""),
  cursos: z.string().max(1000).default(""),
  softwares: z.string().max(1000).default(""),
  equipamentosConhece: z.string().max(1000).default(""),
  experiencia: z.array(z.string()).default([]),
  interesses: z.array(z.string()).default([]),
  conhecimentos: z.record(z.string(), z.number().min(0).max(3)).default({}),
  maiorDificuldade: z.string().max(1000).default(""),
  maiorObjetivo: z.string().max(1000).default(""),
  comoCrescer: z.string().max(1000).default(""),
  dias: z.array(z.string()).default([]),
  periodos: z.array(z.string()).default([]),
  tempoDisponivel: z.string().max(200).default(""),
});

export type BriefingAnswers = z.infer<typeof briefingSchema>;

export function generateSummary(
  answers: BriefingAnswers,
  skillNames: Map<string, string>
): string {
  const parts: string[] = [];

  if (answers.profissao) parts.push(`Profissão: ${answers.profissao}.`);
  parts.push(
    answers.jaServiu
      ? "Já serviu em ministério."
      : "Primeira vez servindo em um ministério."
  );

  const exp = answers.experiencia
    .map((slug) => skillNames.get(slug) ?? slug)
    .join(", ");
  if (exp) parts.push(`Experiência em: ${exp}.`);

  const int = answers.interesses
    .map((slug) => skillNames.get(slug) ?? slug)
    .join(", ");
  if (int) parts.push(`Quer aprender: ${int}.`);

  const niveisAltos = AREAS_CONHECIMENTO.filter(
    (a) => (answers.conhecimentos[a.key] ?? 0) >= 2
  ).map((a) => a.label);
  if (niveisAltos.length > 0) {
    parts.push(`Conhecimento intermediário/avançado em: ${niveisAltos.join(", ")}.`);
  }

  const dias = answers.dias
    .map((d) => DIAS_SEMANA.find((x) => x.key === d)?.label ?? d)
    .join(", ");
  const periodos = answers.periodos
    .map((p) => PERIODOS.find((x) => x.key === p)?.label ?? p)
    .join(", ");
  if (dias) {
    parts.push(`Disponível: ${dias}${periodos ? ` (${periodos.toLowerCase()})` : ""}.`);
  }

  if (answers.maiorObjetivo) parts.push(`Objetivo: ${answers.maiorObjetivo}`);

  return parts.join(" ");
}
