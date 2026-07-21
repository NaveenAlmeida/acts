import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";
const TTL_SECONDS = 3600; // 1h — regenerado a cada render de página

/**
 * Gera uma signed URL para um arquivo do bucket privado `media`.
 * Aceita tanto o path do objeto quanto uma URL pública antiga
 * (compat durante a transição de bucket público → privado).
 * Retorna null se não houver arquivo ou se a assinatura falhar.
 */
export async function signedMediaUrl(
  pathOrUrl: string | null | undefined
): Promise<string | null> {
  if (!pathOrUrl) return null;
  const marker = "/object/public/media/";
  const path = pathOrUrl.includes(marker)
    ? pathOrUrl.split(marker)[1]
    : pathOrUrl;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Versão em lote — assina vários paths de uma vez e devolve um mapa
 * path→signedUrl. Evita N awaits sequenciais ao listar equipamentos.
 */
export async function signedMediaUrls(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      if (!p) return;
      const url = await signedMediaUrl(p);
      if (url) map.set(p, url);
    })
  );
  return map;
}
