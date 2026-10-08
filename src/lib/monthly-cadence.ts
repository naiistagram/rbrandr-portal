export const DEFAULT_MONTHLY_POST_TARGET = 15;

const SOCIAL_CONTENT_TYPES = new Set(["post", "story", "reel", "carousel"]);

export function monthlyPostTarget(brief: unknown): number {
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) return DEFAULT_MONTHLY_POST_TARGET;
  const value = (brief as Record<string, unknown>).monthly_post_target;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1000
    ? value
    : DEFAULT_MONTHLY_POST_TARGET;
}

export function isPlannedSocialPost(item: { content_type: string; status: string; scheduled_date: string | null }, monthKey: string): boolean {
  return SOCIAL_CONTENT_TYPES.has(item.content_type)
    && item.status !== "rejected"
    && item.scheduled_date?.slice(0, 7) === monthKey;
}

export function currentLondonMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "long" }).format(now);
  return { monthKey, label, monthStart: `${monthKey}-01`, nextMonthStart };
}

export function targetsByClient<T extends { client_id: string; brief: unknown }>(projects: T[]): Map<string, number> {
  const targets = new Map<string, number>();
  for (const project of projects) {
    const configured = project.brief && typeof project.brief === "object" && !Array.isArray(project.brief) && "monthly_post_target" in project.brief;
    if (!targets.has(project.client_id) || configured) targets.set(project.client_id, monthlyPostTarget(project.brief));
  }
  return targets;
}
