import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sendWebPush, type PushMessage, type PushTarget } from "./send";

/**
 * Notifica um conjunto de usuários (best-effort). A RPC SECURITY DEFINER
 * `get_push_subscriptions` só devolve inscrições de quem compartilha igreja
 * com o usuário autenticado, então a autorização vive no banco.
 * Nunca lança: uma falha de push não pode quebrar a ação que a disparou.
 */
export async function notifyUsers(userIds: (string | null | undefined)[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_push_subscriptions", { p_user_ids: ids });
    if (error || !data) return;
    await sendWebPush(data as PushTarget[], message);
  } catch (err) {
    console.error("notifyUsers: falha", err);
  }
}
