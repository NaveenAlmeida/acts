export const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  emprestado: "Emprestado",
  indisponivel: "Indisponível",
  baixado: "Baixado",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const EVENT_LABELS: Record<string, string> = {
  cadastro: "Cadastro",
  alteracao: "Alteração",
  uso: "Uso em evento",
  manutencao: "Manutenção",
  emprestimo: "Empréstimo",
  devolucao: "Devolução",
};

export function formatBRL(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date + (date.length === 10 ? "T12:00:00" : "")).toLocaleDateString(
    "pt-BR"
  );
}
