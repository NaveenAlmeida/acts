import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Master (super-admin) tem o Painel como base — sempre.
  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (isPlatformAdmin) redirect("/painel");

  const { data: membership } = await supabase
    .from("church_members")
    .select("churches(slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const slug = (membership?.churches as unknown as { slug: string } | null)
    ?.slug;
  redirect(slug ? `/${slug}` : "/comecar");
}
