import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * O módulo de repertório opera sobre o setor "Louvor" da igreja.
 * Retorna null quando a igreja ainda não criou esse setor.
 */
export async function getLouvorMinistry(
  churchId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ministries")
    .select("id, name")
    .eq("church_id", churchId)
    .or("slug.eq.louvor,name.ilike.%louvor%")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
