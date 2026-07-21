import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry } from "@/lib/infantil";
import { ChildForm } from "@/components/infantil/child-form";

export default async function NovaCriancaPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  // cadastrar exige liderança do setor (ou coordenação da igreja)
  const supabase = await createClient();
  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  const podeGerir =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";
  if (!podeGerir) redirect(`/${churchSlug}/infantil`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastrar criança</h1>
        <p className="text-muted-foreground">
          Só o necessário para cuidar bem e com segurança.
        </p>
      </div>
      <ChildForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
      />
    </div>
  );
}
