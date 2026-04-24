import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

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

  // Members don't have service_type on their own profile — inherit from their project
  let serviceType: string | null = profile.service_type ?? null;
  const clientRole: "ceo" | "member" = (profile.client_role as "ceo" | "member") ?? "ceo";

  let displayCompanyName = profile.company_name;

  if (clientRole === "member") {
    const { data: membership } = await admin
      .from("project_members")
      .select("project_id, projects(service_type, client_id)")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    const proj = (membership?.projects as unknown) as { service_type: string; client_id: string } | null;
    if (proj?.service_type) serviceType = proj.service_type;
    if (proj?.client_id) {
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("company_name")
        .eq("id", proj.client_id)
        .single();
      if (ownerProfile?.company_name) displayCompanyName = ownerProfile.company_name;
    }
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        user={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          company_name: displayCompanyName,
        }}
        serviceType={serviceType}
        clientRole={clientRole}
      />
      <main className="flex-1 ml-60 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
}
