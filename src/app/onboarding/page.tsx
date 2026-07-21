import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect("/");

  const { data: membership } = await supabase
    .from("church_members")
    .select("church_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/comecar");

  const { data: skills } = await supabase
    .from("skills")
    .select("slug, name")
    .eq("church_id", membership.church_id)
    .order("name");

  return (
    <main className="flex min-h-dvh items-start justify-center bg-muted/30 p-6 pt-10">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bem-vindo! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Queremos te conhecer melhor — leva 1 minuto e você pode pular
            e responder depois
          </p>
        </div>
        <OnboardingWizard skills={skills ?? []} />
      </div>
    </main>
  );
}
