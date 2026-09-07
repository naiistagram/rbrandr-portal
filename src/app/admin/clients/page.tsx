import { createAdminClient } from "@/lib/supabase/admin";
import AdminClientsClient from "./clients-client";
import type { Profile } from "@/lib/supabase/types";

type ClientWithStatus = Profile & { email_confirmed: boolean };

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const admin = createAdminClient();
  const [{ data: clients, error: clientsError }, { data: authData, error: usersError }] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const loadError = clientsError?.message ?? usersError?.message ?? "";
  const confirmedEmails = new Set(
    (authData?.users ?? []).filter((user) => user.email_confirmed_at).map((user) => user.email)
  );
  const initialClients: ClientWithStatus[] = (clients ?? []).map((client) => ({
    ...client,
    email_confirmed: confirmedEmails.has(client.email),
  }));

  return <AdminClientsClient initialClients={initialClients} initialLoadError={loadError} />;
}
