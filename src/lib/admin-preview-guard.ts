import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verifies the current session belongs to an admin and that `clientId` is a
 * real client account, then returns the admin (service-role) client plus the
 * target client's profile. Cached per-request so the layout and page for a
 * given preview route each pay for this only once.
 */
export const getPreviewClient = cache(async (clientId: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: requester } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (requester?.role !== "admin") redirect("/dashboard");

  const { data: client } = await admin.from("profiles").select("*").eq("id", clientId).eq("role", "client").single();
  if (!client) notFound();

  return { admin, client };
});
