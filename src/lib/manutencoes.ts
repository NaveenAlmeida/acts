export const TICKET_STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguardando peça",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const TICKET_STATUS_BADGE: Record<string, string> = {
  aberto: "bg-red-500/15 text-red-700 dark:text-red-400",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  aguardando_peca: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  concluido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelado: "bg-muted text-muted-foreground",
};

export const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_BADGE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  alta: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgente: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const CRITERIOS = [
  { key: "pontualidade", label: "Pontualidade" },
  { key: "organizacao", label: "Organização" },
  { key: "conhecimento", label: "Conhecimento" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "trabalho_equipe", label: "Trabalho em equipe" },
  { key: "comprometimento", label: "Comprometimento" },
] as const;

export function downtimeLabel(openedAt: string, resolvedAt: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  const hours = Math.round(
    (end.getTime() - new Date(openedAt).getTime()) / 3600000
  );
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
