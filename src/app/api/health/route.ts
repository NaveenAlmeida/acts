import { createClient } from "@/lib/supabase/server";

/**
 * Health check para monitor de uptime (UptimeRobot, Cloudflare Health
 * Checks etc.). Testa o app E o banco — um SELECT leve numa tabela real.
 * 200 = app e banco no ar · 503 = banco inacessível.
 * Não vaza dados: só conta/erro.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    // consulta barata que exercita a conexão sem depender de sessão
    const { error } = await supabase
      .from("churches")
      .select("id", { count: "exact", head: true });

    if (error) {
      return Response.json(
        { status: "degraded", db: "erro", ms: Date.now() - started },
        { status: 503 }
      );
    }
    return Response.json({
      status: "ok",
      db: "ok",
      ms: Date.now() - started,
    });
  } catch {
    return Response.json(
      { status: "down", ms: Date.now() - started },
      { status: 503 }
    );
  }
}
