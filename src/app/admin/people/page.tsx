import { PeopleDirectory } from "./people-directory";

export const dynamic = "force-dynamic";

// The admin layout restricts this page to admins, and its data loads from
// /api/admin/social-people, which checks admin access itself.
export default function AdminPeoplePage() {
  return <PeopleDirectory />;
}
