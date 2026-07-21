import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";

export type MinistryOption = {
  id: string;
  name: string;
  slug: string;
  /** pode gerir a escala deste setor (coord da igreja, ou gerente/líder do setor) */
  canManage: boolean;
};

export type ActiveMinistry = {
  active: MinistryOption | null;
  options: MinistryOption[];
};

export const MINISTRY_COOKIE = "acts_ministry";

/**
 * Resolve o setor ativo da pessoa nesta igreja:
 * - coordenador/admin da igreja → todos os setores (gere todos);
 * - demais → os setores de que é membro (gere onde é gerente/líder).
 * O setor ativo vem do cookie, com fallback no primeiro da lista.
 */
export const getActiveMinistry = cache(
  async (churchSlug: string): Promise<ActiveMinistry> => {
    const tenant = await getTenant(churchSlug);
    const supabase = await createClient();
    const cid = tenant.church.id;

    let options: MinistryOption[] = [];
    if (tenant.isCoord) {
      const { data } = await supabase
        .from("ministries")
        .select("id, name, slug")
        .eq("church_id", cid)
        .order("name");
      options = (data ?? []).map((m) => ({ ...m, canManage: true }));
    } else {
      const { data } = await supabase
        .from("ministry_members")
        .select("role, ministries!inner(id, name, slug)")
        .eq("church_id", cid)
        .eq("user_id", tenant.userId)
        .eq("active", true);
      options = (data ?? [])
        .map((row) => {
          const m = row.ministries as unknown as {
            id: string;
            name: string;
            slug: string;
          };
          return {
            id: m.id,
            name: m.name,
            slug: m.slug,
            canManage: row.role === "gerente" || row.role === "lider",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    const cookieVal = (await cookies()).get(MINISTRY_COOKIE)?.value;
    const active =
      options.find((m) => m.id === cookieVal) ?? options[0] ?? null;
    return { active, options };
  }
);
