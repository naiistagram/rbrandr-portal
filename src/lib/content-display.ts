// Shared visual config for content items — used by the Content page and the
// dashboard's pending-content preview so both render cards identically.

export const PLATFORM_CONFIG: Record<string, { color: string; bg: string; dot: string; pill: string }> = {
  Instagram: { color: "text-pink-400", bg: "from-purple-600/30 to-pink-600/30", dot: "bg-gradient-to-br from-purple-500 to-pink-500", pill: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  Facebook: { color: "text-blue-400", bg: "from-blue-700/30 to-blue-500/30", dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TikTok: { color: "text-rose-400", bg: "from-zinc-800/80 to-rose-900/30", dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  LinkedIn: { color: "text-sky-400", bg: "from-sky-700/30 to-sky-500/30", dot: "bg-sky-500", pill: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Twitter/X": { color: "text-zinc-300", bg: "from-zinc-700/40 to-zinc-600/20", dot: "bg-zinc-400", pill: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" },
  YouTube: { color: "text-red-400", bg: "from-red-700/30 to-red-500/20", dot: "bg-red-500", pill: "bg-red-500/10 text-red-400 border-red-500/20" },
  Email: { color: "text-emerald-400", bg: "from-emerald-700/30 to-emerald-500/20", dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Blog: { color: "text-amber-400", bg: "from-amber-700/30 to-amber-500/20", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export const TYPE_PILL: Record<string, string> = {
  post: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reel: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  carousel: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  ad: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  email: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  blog: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  other: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export const PLATFORM_ORDER = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];
