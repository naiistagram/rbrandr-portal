import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Use admin client so RLS never blocks reading our own profile
  let { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email!.split("@")[0];
    // ignoreDuplicates: true prevents overwriting an existing admin role
    await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email!,
        full_name: fullName,
        company_name: (user.user_metadata?.company_name as string | null) ?? null,
        avatar_url: null,
        role: "client",
      },
      { ignoreDuplicates: true }
    );

    const { data: created } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!created) redirect("/api/auth/signout");
    profile = created;
  }

  // Admins use the admin panel
  if (profile.role === "admin") redirect("/admin/dashboard");

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        user={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          company_name: profile.company_name,
        }}
        serviceType={profile.service_type ?? null}
      />
      <main className="flex-1 ml-60 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
}
