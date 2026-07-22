/**
 * Sustentação do Acts — números num lugar só.
 * O valor cobre servidor e domínio; igreja sem condição é isenta.
 */
export const PRECO_MENSAL = 19;
export const PRECO_ANUAL = 190;
export const DIAS_TRIAL = 30;
/** Dias de tolerância após o vencimento antes de restringir ações administrativas. */
export const DIAS_GRACA = 15;

export type BillingStatus = "trial" | "ativa" | "pendente" | "isenta";

export const BILLING_LABEL: Record<BillingStatus, string> = {
  trial: "Período de teste",
  ativa: "Em dia",
  pendente: "Pagamento pendente",
  isenta: "Isenta",
};

/** Dias restantes até o vencimento (negativo = vencido há N dias). */
export function diasRestantes(paidUntil: string | null): number | null {
  if (!paidUntil) return null;
  const fim = new Date(paidUntil + "T23:59:59");
  return Math.ceil((fim.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Novo vencimento ao confirmar um pagamento: soma meses ao vencimento atual
 * (ou a hoje, se já venceu) — assim quem paga adiantado não perde dias.
 *
 * Cuidado com o overflow do setMonth: 31/01 + 1 mês vira 03/03 em JS. Aqui a
 * data é grampeada no último dia do mês alvo (28/02), que é o comportamento
 * esperado de cobrança.
 */
export function proximoVencimento(
  paidUntil: string | null,
  meses = 1,
  hoje = new Date()
): string {
  const atual = paidUntil ? new Date(paidUntil + "T12:00:00") : null;
  const base = atual && atual > hoje ? atual : new Date(hoje);
  const dia = base.getDate();
  base.setDate(1); // evita o overflow antes de trocar o mês
  base.setMonth(base.getMonth() + meses);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(dia, ultimoDia));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/**
 * A igreja pode usar tudo? Isenta sempre pode. Vencida só perde ações
 * administrativas DEPOIS da graça — escala e infantil nunca param, porque
 * travar no domingo de manhã quebraria o culto.
 */
export function podeAdministrar(
  status: BillingStatus,
  paidUntil: string | null
): boolean {
  if (status === "isenta") return true;
  const dias = diasRestantes(paidUntil);
  if (dias === null) return true;
  return dias > -DIAS_GRACA;
}
