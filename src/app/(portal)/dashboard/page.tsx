import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }, { data: allContent }, { data: pendingForms }, { data: pendingContracts }, { data: openTickets }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("projects").select("*").eq("client_id", user.id).order("created_at", { ascending: false }),
      supabase.from("content_items").select("*").order("updated_at", { ascending: false }).limit(50),
      supabase.from("forms").select("*").eq("status", "pending").limit(10),
      supabase.from("contracts").select("id, title, status").eq("status", "pending").limit(10),
      supabase.from("tickets").select("id, title, status, priority").eq("status", "open").limit(10),
    ]);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Dashboard"
        subtitle={profile ? `Welcome back, ${profile.full_name.split(" ")[0]}` : ""}
        userId={user.id}
      />
      <DashboardClient
        projects={projects ?? []}
        allContent={allContent ?? []}
        pendingForms={pendingForms ?? []}
        pendingContracts={pendingContracts ?? []}
        openTickets={openTickets ?? []}
      />
    </div>
  );
}
