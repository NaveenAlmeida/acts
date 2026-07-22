// Entry do Worker: o handler `fetch` continua sendo o que o OpenNext gera; a
// única coisa que acrescentamos é o `scheduled`, que o OpenNext não expõe.
//
// O cron chama a rota Next em processo (sem sair para a rede), passando o
// segredo no cabeçalho. Assim toda a lógica de lembrete continua no Next, com
// acesso aos helpers de push e ao Supabase, em vez de virar código solto aqui.
import openNext from "./.open-next/worker.js";

export default {
  fetch: openNext.fetch,

  async scheduled(event, env, ctx) {
    const requisicao = new Request("https://cron.interno/api/cron", {
      method: "POST",
      headers: { "x-cron-secret": env.CRON_SECRET ?? "" },
    });
    const resposta = await openNext.fetch(requisicao, env, ctx);
    // O log vai para o observability do Worker, que já está ligado.
    console.log("cron", event.cron, resposta.status, await resposta.text());
  },
};

// O OpenNext pode exportar Durable Objects (fila, tag cache). Reexportamos
// tudo o que não seja o default para não quebrar essas ligações.
export * from "./.open-next/worker.js";
