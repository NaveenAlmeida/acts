import { describe, expect, it } from "vitest";
import { ageInMonths, formatAge, suggestClass, type ChildClass } from "@/lib/infantil";

// Referência fixa: sem isso o teste quebra sozinho com o passar do tempo.
const ref = new Date("2026-07-22T12:00:00");

describe("ageInMonths", () => {
  it("conta os meses completos", () => {
    expect(ageInMonths("2025-07-22", ref)).toBe(12);
    expect(ageInMonths("2026-01-22", ref)).toBe(6);
  });

  it("não conta o mês antes do dia do aniversário", () => {
    // faltando um dia para completar 12 meses
    expect(ageInMonths("2025-07-23", ref)).toBe(11);
  });

  it("recém-nascido é 0, nunca negativo", () => {
    expect(ageInMonths("2026-07-22", ref)).toBe(0);
    expect(ageInMonths("2027-01-01", ref)).toBe(0); // data futura não quebra
  });
});

describe("formatAge", () => {
  it("bebê aparece em meses", () => {
    expect(formatAge("2026-04-22")).toMatch(/mês|meses/);
  });
  it("singular de mês", () => {
    const umMes = new Date();
    umMes.setMonth(umMes.getMonth() - 1);
    expect(formatAge(umMes.toISOString().slice(0, 10))).toBe("1 mês");
  });
});

// A turma sugerida decide em qual sala a criança entra — errar aqui coloca
// uma criança de 2 anos numa turma de 10.
describe("suggestClass", () => {
  const turmas: ChildClass[] = [
    { id: "b", name: "Berçário", min_age_months: 0, max_age_months: 35 },
    { id: "m", name: "Maternal", min_age_months: 36, max_age_months: 59 },
    { id: "j", name: "Jardim", min_age_months: 60, max_age_months: 83 },
  ];

  it("bebê vai para o berçário", () => {
    expect(suggestClass("2025-07-22", turmas)?.name).toBe("Berçário");
  });

  it("três anos vai para o maternal", () => {
    expect(suggestClass("2023-01-22", turmas)?.name).toBe("Maternal");
  });

  it("respeita a borda exata da faixa (35 vs 36 meses)", () => {
    const trintaECinco = new Date();
    trintaECinco.setMonth(trintaECinco.getMonth() - 35);
    const trintaESeis = new Date();
    trintaESeis.setMonth(trintaESeis.getMonth() - 36);
    expect(suggestClass(trintaECinco.toISOString().slice(0, 10), turmas)?.name).toBe("Berçário");
    expect(suggestClass(trintaESeis.toISOString().slice(0, 10), turmas)?.name).toBe("Maternal");
  });

  it("criança fora de qualquer faixa não recebe turma (em vez de cair na errada)", () => {
    expect(suggestClass("2010-01-01", turmas)).toBeNull();
  });

  it("sem turmas cadastradas, devolve null sem quebrar", () => {
    expect(suggestClass("2024-01-01", [])).toBeNull();
  });
});
