import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPublishingCalendar } from "./publishing-calendar";

export const dynamic = "force-dynamic";

type CalendarContent = {
  id: string;
  project_id: string;
  title: string;
  content_type: string;
  description: string | null;
  file_urls: string[] | null;
  platforms: string[];
  status: "draft" | "in_review" | "approved" | "rejected" | "published";
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_at: string | null;
  publish_error: string | null;
  projects: { client_id: string; name: string; profiles: { full_name: string; company_name: string | null } | null } | null;
};

type Connection = { project_id: string; platform: "Facebook" | "Instagram" | "LinkedIn"; account_name: string };

export default async function AdminCalendarPage() {
  const admin = createAdminClient();
  const [{ data: content, error: contentError }, { data: connections, error: connectionsError }] = await Promise.all([
    admin
      .from("content_items")
      .select("id, project_id, title, content_type, description, file_urls, platforms, status, scheduled_date, scheduled_time, publish_at, publish_error, projects(client_id, name, profiles(full_name, company_name))")
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true }),
    admin.from("social_connections").select("project_id, platform, account_name").order("platform"),
  ]);

  const calendarContent: CalendarContent[] = (content ?? []).map((item) => {
    const project = Array.isArray(item.projects) ? item.projects[0] : item.projects;
    const profile = project && Array.isArray(project.profiles) ? project.profiles[0] : project?.profiles;
    return {
      ...item,
      platforms: item.platforms ?? [],
      projects: project ? { client_id: project.client_id, name: project.name, profiles: profile ?? null } : null,
    } as CalendarContent;
  });

  return (
    <AdminPublishingCalendar
      initialContent={calendarContent}
      connections={(connections ?? []) as Connection[]}
      loadError={contentError?.message ?? connectionsError?.message ?? null}
    />
  );
}
