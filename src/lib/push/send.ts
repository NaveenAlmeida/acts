import "server-only";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { serverEnv } from "@/lib/env";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Envia uma notificação Web Push para os alvos (best-effort).
 * Roda no runtime do Worker via WebCrypto (o `web-push` do Node não funciona lá).
 * Assina com a chave privada VAPID (secret de runtime).
 */
export async function sendWebPush(targets: PushTarget[], message: PushMessage): Promise<void> {
  if (targets.length === 0) return;
  const publicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = serverEnv("VAPID_PRIVATE_KEY");
  const subject = serverEnv("VAPID_SUBJECT") ?? "mailto:contato@acts.app";
  if (!publicKey || !privateKey) {
    console.warn("sendWebPush: chaves VAPID ausentes — notificação ignorada");
    return;
  }
  const vapid = { subject, publicKey, privateKey };

  await Promise.allSettled(
    targets.map(async (t) => {
      const subscription = {
        endpoint: t.endpoint,
        expirationTime: null,
        keys: { p256dh: t.p256dh, auth: t.auth },
      };
      const data: Record<string, string> = { title: message.title, body: message.body };
      if (message.url) data.url = message.url;
      if (message.tag) data.tag = message.tag;
      try {
        const payload = await buildPushPayload(
          { data, options: { ttl: 60 * 60 * 24, urgency: "normal" } },
          subscription,
          vapid
        );
        const res = await fetch(subscription.endpoint, {
          method: payload.method,
          headers: payload.headers,
          body: payload.body as BodyInit,
        });
        if (!res.ok) {
          // 404/410 = inscrição expirada/removida (limpeza fica p/ Fase B)
          console.warn("sendWebPush:", res.status, subscription.endpoint.slice(0, 48));
        }
      } catch (err) {
        console.error("sendWebPush: falha ao enviar", err);
      }
    })
  );
}
