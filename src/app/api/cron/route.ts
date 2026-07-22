import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { sendWebPush, type PushTarget } from "@/lib/push/send";

type Lembrete = PushTarget & {
  user_id: string;
  titulo: string;
  corpo: string;
  url: string;
};

/**
 * Os lembretes do dia — a única coisa no Acts que roda sem ninguém clicar.
 *
 * Chamada pelo handler `scheduled` do Worker (ver worker.js na raiz). A rota é
 * pública por natureza, então a prova de identidade é o CRON_SECRET: sem ele,
 * 404 — e não 401, para não confirmar a existência do endpoint a quem sonda.
 *
 * O segredo também vai para o banco: a RPC `lembretes_do_dia` é SECURITY
 * DEFINER e devolve inscrições de push, então ela mesma exige a prova. Assim
 * não precisamos da chave de service-role aqui dentro, que daria acesso
 * irrestrito ao banco caso o Worker fosse comprometido.
 */
export async function POST(request: Request): Promise<Response> {
  const segredo = serverEnv("CRON_SECRET");
  const enviado = request.headers.get("x-cron-secret");
  if (!segredo || enviado !== segredo) {
    return new Response("Not found", { status: 404 });
  }

  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return Response.json({ ok: false, erro: "supabase não configurado" }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("lembretes_do_dia", {
    p_secret: segredo,
  });
  if (error) {
    console.error("cron: RPC falhou", error.message);
    return Response.json({ ok: false, erro: error.message }, { status: 500 });
  }

  // A RPC já marcou como enviado. Uma falha de push daqui em diante não repete
  // o lembrete amanhã — é o preço de não arriscar mandar duas vezes.
  const lembretes = (data ?? []) as Lembrete[];
  let enviados = 0;
  for (const l of lembretes) {
    try {
      await sendWebPush([{ endpoint: l.endpoint, p256dh: l.p256dh, auth: l.auth }], {
        title: l.titulo,
        body: l.corpo,
        url: l.url,
        // um lembrete por assunto: o novo substitui o anterior na bandeja
        tag: l.url,
      });
      enviados++;
    } catch (err) {
      console.error("cron: push falhou", err);
    }
  }

  return Response.json({ ok: true, lembretes: lembretes.length, enviados });
}
