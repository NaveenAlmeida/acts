import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lê uma variável de ambiente de SERVIDOR (secret) de forma portável:
 * - Em produção (Cloudflare Worker) via getCloudflareContext().env
 * - Em `next dev` / Node via process.env (carregado do .env.local)
 * Nunca use para segredos no cliente — só server.
 */
export function serverEnv(key: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as Record<string, unknown> | undefined)?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // fora de contexto de request (build, scripts) — cai no process.env
  }
  return process.env[key];
}
