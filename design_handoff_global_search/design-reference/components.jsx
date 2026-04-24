/* Mock portal chrome + 6 UX enhancement ideas.
   Matches RBRANDR portal aesthetic: dark (#09090b), pink accent (#ed0194), Geist-style sans. */

const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Icons (inline SVG, lucide-style stroke) ---------- */
const Ico = ({ d, size = 16, stroke = 1.6, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);
const Icon = {
  Dashboard: (p) => <Ico {...p}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></Ico>,
  Folder: (p) => <Ico {...p}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></Ico>,
  Calendar: (p) => <Ico {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Ico>,
  Image: (p) => <Ico {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></Ico>,
  FileText: (p) => <Ico {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></Ico>,
  Scroll: (p) => <Ico {...p}><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></Ico>,
  Chart: (p) => <Ico {...p}><path d="M3 3v18h18"/><path d="M7 16V10M12 16V7M17 16v-5"/></Ico>,
  Ticket: (p) => <Ico {...p}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></Ico>,
  Book: (p) => <Ico {...p}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></Ico>,
  Msg: (p) => <Ico {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></Ico>,
  Milestone: (p) => <Ico {...p}><path d="M12 13v8M12 3v3M18 9l3 4-3 4H6a2 2 0 0 1 0-4 2 2 0 0 0 0-4Z"/></Ico>,
  Bell: (p) => <Ico {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Ico>,
  Search: (p) => <Ico {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ico>,
  Settings: (p) => <Ico {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Ico>,
  LogOut: (p) => <Ico {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></Ico>,
  Chevron: (p) => <Ico {...p}><path d="m9 18 6-6-6-6"/></Ico>,
  ChevronDown: (p) => <Ico {...p}><path d="m6 9 6 6 6-6"/></Ico>,
  Check: (p) => <Ico {...p}><path d="M20 6 9 17l-5-5"/></Ico>,
  Circle: (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/></Ico>,
  Plus: (p) => <Ico {...p}><path d="M12 5v14M5 12h14"/></Ico>,
  Upload: (p) => <Ico {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></Ico>,
  Keyboard: (p) => <Ico {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></Ico>,
  Sparkles: (p) => <Ico {...p}><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5Z"/><path d="M5 17v4M3 19h4M19 14v3M17.5 15.5h3"/></Ico>,
  Clock: (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Ico>,
  Help: (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></Ico>,
  Arrow: (p) => <Ico {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Ico>,
  Pin: (p) => <Ico {...p}><path d="M12 17v5M9 10.8a3 3 0 0 1 0-4.2l2-2a3 3 0 0 1 4.2 0l2 2a3 3 0 0 1 0 4.2L15 14H9Z"/></Ico>,
  Flag: (p) => <Ico {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1ZM4 22V15"/></Ico>,
  Eye: (p) => <Ico {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></Ico>,
  Command: (p) => <Ico {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3Z"/></Ico>,
};

/* ---------- Shared tokens ---------- */
const C = {
  bg: "#09090b",
  surface: "#111113",
  surface2: "#1a1a1e",
  border: "#27272a",
  borderSub: "#1f1f23",
  fg: "#fafafa",
  muted: "#a1a1aa",
  subtle: "#52525b",
  accent: "#ed0194",
  accentHover: "#d4017f",
  accentSub: "rgba(237, 1, 148, 0.1)",
  accentPurple: "#b400a7",
};

/* ---------- Frame: portal chrome wrapper ---------- */
function PortalFrame({ title, subtitle, active = "/dashboard", extraTopbar, children, bellDot = true }) {
  const nav = [
    { label: "Dashboard", href: "/dashboard", Icon: Icon.Dashboard },
    { label: "Content Calendar", href: "/calendar", Icon: Icon.Calendar },
    { label: "All Content", href: "/content", Icon: Icon.Image },
    { label: "Timeline", href: "/timeline", Icon: Icon.Milestone },
    { label: "Brand Assets", href: "/assets", Icon: Icon.Folder },
    { label: "Forms", href: "/forms", Icon: Icon.FileText },
    { label: "Contracts & T&Cs", href: "/contracts", Icon: Icon.Scroll },
    { label: "Reports", href: "/reports", Icon: Icon.Chart },
  ];
  return (
    <div style={{ width: 1280, height: 820, background: C.bg, color: C.fg, fontFamily: "'Geist', 'Inter', system-ui, sans-serif", display: "flex", overflow: "hidden", borderRadius: 12 }}>
      {/* sidebar */}
      <aside style={{ width: 240, borderRight: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.accentPurple})`, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 12, letterSpacing: -0.5 }}>R</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: -0.2, whiteSpace: "nowrap" }}>LUMEN STUDIO</div>
            <div style={{ fontSize: 10, color: C.subtle, textTransform: "uppercase", letterSpacing: 2 }}>Client Portal</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map(({ label, href, Icon: I }) => {
            const a = href === active;
            return (
              <div key={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: a ? C.accentSub : "transparent",
                color: a ? C.accent : C.muted,
              }}>
                <I size={15} stroke={a ? 2 : 1.6} />
                <span>{label}</span>
                {a && <div style={{ marginLeft: "auto", color: C.accent, opacity: .6 }}><Icon.Chevron size={12} /></div>}
              </div>
            );
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", color: C.muted, fontSize: 13 }}>
            <Icon.Settings size={15} /> Settings
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.accentSub, border: `1px solid ${C.accent}4D`, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: C.accent }}>D</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Dean</div>
              <div style={{ fontSize: 10, color: C.subtle }}>Lumen Studio</div>
            </div>
            <Icon.LogOut size={14} />
          </div>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: `${C.bg}cc`, backdropFilter: "blur(8px)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: C.subtle }}>{subtitle}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {extraTopbar}
            <button style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", color: C.muted, display: "grid", placeItems: "center", position: "relative", border: "none" }}>
              <Icon.Bell size={15} />
              {bellDot && <span style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.accent }} />}
            </button>
          </div>
        </header>
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Reusable card ---------- */
const Card = ({ children, style, ...p }) => (
  <div {...p} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>
);

/* =================================================================
   ENHANCEMENT 1 — Command Palette (⌘K)
   ================================================================= */
function CommandPalette() {
  const [q, setQ] = useState("brand");
  const items = [
    { g: "Go to", i: Icon.Dashboard, t: "Dashboard", s: "/dashboard" },
    { g: "Go to", i: Icon.Folder, t: "Brand Assets", s: "/assets", match: true },
    { g: "Go to", i: Icon.Calendar, t: "Content Calendar", s: "/calendar" },
    { g: "Actions", i: Icon.Upload, t: "Upload new brand asset", s: "⇧ U", match: true },
    { g: "Actions", i: Icon.Plus, t: "Submit new ticket", s: "N T" },
    { g: "Recent", i: Icon.Image, t: "Spring Campaign — Hero 03.png", s: "Brand Assets" },
    { g: "Recent", i: Icon.FileText, t: "Onboarding Form — draft", s: "Forms" },
  ].filter(x => q ? (x.t.toLowerCase().includes(q.toLowerCase()) || x.g.toLowerCase().includes(q.toLowerCase())) : true);

  const groups = items.reduce((acc, x) => ((acc[x.g] ||= []).push(x), acc), {});

  return (
    <PortalFrame title="Dashboard" subtitle="Welcome back, Dean" bellDot>
      {/* backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "grid", placeItems: "start center", paddingTop: 100 }}>
        <div style={{ width: 620, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(237,1,148,.08)", overflow: "hidden" }}>
          {/* search */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
            <Icon.Search size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search or jump to..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.fg, fontSize: 14, fontFamily: "inherit" }} />
            <kbd style={{ fontSize: 10, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, background: C.surface2 }}>ESC</kbd>
          </div>
          {/* results */}
          <div style={{ maxHeight: 420, overflow: "auto", padding: "8px 0" }}>
            {Object.entries(groups).map(([g, arr]) => (
              <div key={g} style={{ padding: "6px 0" }}>
                <div style={{ padding: "6px 18px", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600 }}>{g}</div>
                {arr.map((x, i) => {
                  const active = g === "Go to" && i === 0 && q === "brand";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", background: active ? C.accentSub : "transparent", color: active ? C.fg : C.fg, cursor: "pointer", fontSize: 13 }}>
                      <span style={{ color: active ? C.accent : C.muted }}><x.i size={15} /></span>
                      <span style={{ flex: 1 }}>
                        {x.match ? <Highlight text={x.t} q={q}/> : x.t}
                      </span>
                      <span style={{ fontSize: 11, color: C.subtle, fontFamily: "ui-monospace, monospace" }}>{x.s}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* footer */}
          <div style={{ display: "flex", gap: 16, padding: "10px 18px", borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.subtle, background: C.surface2 }}>
            <span><kbd style={kbdSty}>↵</kbd> open</span>
            <span><kbd style={kbdSty}>↑↓</kbd> navigate</span>
            <span style={{ marginLeft: "auto" }}><kbd style={kbdSty}>⌘</kbd><kbd style={kbdSty}>K</kbd> anywhere</span>
          </div>
        </div>
      </div>
    </PortalFrame>
  );
}
const kbdSty = { fontSize: 9, padding: "2px 5px", border: `1px solid ${C.border}`, borderRadius: 3, marginRight: 3, color: C.muted, fontFamily: "ui-monospace, monospace" };
function Highlight({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark style={{ background: "transparent", color: C.accent, fontWeight: 700 }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/* =================================================================
   ENHANCEMENT 2 — "What needs you" card (actionable dashboard)
   ================================================================= */
function NeedsYouCard() {
  const items = [
    { tag: "Approve", urgent: true,  t: "3 posts need approval by Friday", sub: "Content Calendar · Apr 26", i: Icon.Check },
    { tag: "Sign",    urgent: true,  t: "Statement of Work v3 awaiting signature", sub: "Contracts & T&Cs", i: Icon.Scroll },
    { tag: "Review",  urgent: false, t: "Logo exploration — 4 directions to review", sub: "Brand Assets · 2 days ago", i: Icon.Image },
    { tag: "Fill out",urgent: false, t: "Quarterly feedback form", sub: "Forms · Optional", i: Icon.FileText },
  ];
  return (
    <PortalFrame title="Dashboard" subtitle="Welcome back, Dean">
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, height: "100%", overflow: "auto" }}>
        {/* Left: NEEDS YOU */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 12px ${C.accent}` }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Needs your attention</div>
                <div style={{ fontSize: 11, color: C.subtle }}>4 items waiting · clear them to move your projects forward</div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: C.muted, padding: "4px 10px", borderRadius: 999, background: C.surface2, border: `1px solid ${C.border}` }}>2 urgent</span>
          </div>
          <div>
            {items.map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.borderSub}` : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: x.urgent ? C.accentSub : C.surface2, border: `1px solid ${x.urgent ? C.accent + "4D" : C.border}`, display: "grid", placeItems: "center", color: x.urgent ? C.accent : C.muted }}>
                  <x.i size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
                      background: x.urgent ? C.accentSub : C.surface2,
                      color: x.urgent ? C.accent : C.muted,
                      border: `1px solid ${x.urgent ? C.accent + "4D" : C.border}` }}>{x.tag}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{x.t}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.subtle, marginTop: 3 }}>{x.sub}</div>
                </div>
                <button style={{ fontSize: 12, color: C.muted, background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  Open <Icon.Arrow size={12} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: project pulse + tiny stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600 }}>Project pulse</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>64<span style={{ fontSize: 16, color: C.muted }}>%</span></div>
              <div style={{ fontSize: 11, color: C.subtle }}>Brand refresh · Phase 2 of 3</div>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.surface2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: "64%", height: "100%", background: `linear-gradient(90deg, ${C.accentPurple}, ${C.accent})` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: C.subtle }}>
              <span>Kicked off Mar 3</span>
              <span>Next milestone · May 8</span>
            </div>
          </Card>
          <Card style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[{ n: 12, l: "Posts this month" }, { n: 48, l: "Assets shared" }, { n: 3, l: "Open tickets" }, { n: "4.9", l: "Feedback avg", hl: true }].map((x, i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontWeight: 700, color: x.hl ? C.accent : C.fg }}>{x.n}</div>
                <div style={{ fontSize: 10, color: C.subtle, letterSpacing: 0.5, textTransform: "uppercase" }}>{x.l}</div>
              </div>
            ))}
          </Card>
          <Card style={{ padding: 18, flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600, marginBottom: 10 }}>Today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { t: "09:30", e: "Weekly creative sync", type: "meeting" },
                { t: "14:00", e: "IG Reel goes live", type: "publish" },
                { t: "17:00", e: "Brand kit v2 drop", type: "deliverable" },
              ].map((x, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", color: C.muted, width: 44 }}>{x.t}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: x.type === "publish" ? C.accent : C.subtle }} />
                  <span>{x.e}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PortalFrame>
  );
}

/* =================================================================
   ENHANCEMENT 3 — Global Search + recently viewed
   ================================================================= */
function SearchTopbar() {
  return (
    <PortalFrame
      title="Brand Assets"
      subtitle="48 files · Updated 2 hours ago"
      active="/assets"
      extraTopbar={
        <button style={{ display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 12px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12 }}>
          <Icon.Search size={14} />
          <span>Search everything…</span>
          <span style={{ display: "flex", gap: 2, marginLeft: 24 }}>
            <kbd style={kbdSty}>⌘</kbd><kbd style={kbdSty}>K</kbd>
          </span>
        </button>
      }
    >
      <div style={{ padding: 24, height: "100%", overflow: "hidden" }}>
        {/* filter row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["All", "Logos", "Photography", "Typography", "Video", "Guidelines"].map((x, i) => (
            <button key={i} style={{
              padding: "6px 12px", fontSize: 12, borderRadius: 7,
              background: i === 1 ? C.accentSub : C.surface, color: i === 1 ? C.accent : C.muted,
              border: `1px solid ${i === 1 ? C.accent + "4D" : C.border}`, fontWeight: 500,
            }}>{x}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={{ padding: "6px 12px", fontSize: 12, borderRadius: 7, background: C.surface, color: C.muted, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            Recent <Icon.ChevronDown size={12} />
          </button>
        </div>
        {/* grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "4/3", background: `linear-gradient(135deg, ${["#1a1a1e","#201820","#15151a","#1a181e"][i%4]}, ${C.surface})`, borderBottom: `1px solid ${C.border}`, position: "relative", display: "grid", placeItems: "center", color: C.subtle }}>
                {i === 0 && <div style={{ fontSize: 42, fontWeight: 900, color: C.accent, letterSpacing: -3 }}>L</div>}
                {i === 1 && <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Geist Mono',ui-monospace" }}>LUMEN</div>}
                {i > 1 && <Icon.Image size={28} />}
                <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(0,0,0,.5)", color: C.muted, fontFamily: "ui-monospace, monospace" }}>{["SVG","PNG","JPG","PDF","PNG","MP4","PNG","PDF"][i]}</span>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{["Primary mark","Wordmark","Hero — Spring","Team photo 01","Color system","Brand reel","Icon set v2","Style guide"][i]}</div>
                <div style={{ fontSize: 10, color: C.subtle, marginTop: 2 }}>Updated {["2h","5h","1d","1d","2d","3d","5d","1w"][i]} ago</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PortalFrame>
  );
}

/* =================================================================
   ENHANCEMENT 4 — Guided Empty States
   ================================================================= */
function EmptyStates() {
  return (
    <PortalFrame title="Content Calendar" subtitle="Plan and approve your posts" active="/calendar">
      <div style={{ padding: 24, height: "100%", overflow: "hidden" }}>
        <Card style={{ padding: "56px 40px", display: "grid", placeItems: "center", textAlign: "center", height: "calc(100% - 8px)" }}>
          <div style={{ maxWidth: 480 }}>
            {/* illustration — stripes */}
            <div style={{ width: 128, height: 128, margin: "0 auto 28px", borderRadius: 16, background: `repeating-linear-gradient(135deg, ${C.surface2}, ${C.surface2} 8px, ${C.surface} 8px, ${C.surface} 16px)`, border: `1px solid ${C.border}`, display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%, ${C.accent}22, transparent 60%)` }} />
              <Icon.Calendar size={38} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Your calendar is a blank page</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              This is where you'll see upcoming posts across channels, approve drafts, and keep the team in sync. We'll populate it as soon as your first campaign is scheduled.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 28 }}>
              <button style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, background: C.accent, color: "white", border: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.Plus size={14}/> Request first post
              </button>
              <button style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, background: "transparent", color: C.fg, border: `1px solid ${C.border}` }}>
                Watch 60-sec tour
              </button>
            </div>
            {/* next-best-actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "left" }}>
              {[
                { i: Icon.Upload, t: "Upload inspiration", s: "Moodboards, refs" },
                { i: Icon.FileText, t: "Fill content brief", s: "2 min · 4 fields" },
                { i: Icon.Msg, t: "Chat with strategist", s: "Sara · online" },
              ].map((x, i) => (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: C.accent }}><x.i size={16} /></span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{x.t}</div>
                    <div style={{ fontSize: 10, color: C.subtle, marginTop: 1 }}>{x.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </PortalFrame>
  );
}

/* =================================================================
   ENHANCEMENT 5 — Inline contextual help "Did you mean?"
   Breadcrumbs + Recently viewed chip row + contextual help popover
   ================================================================= */
function ContextualHelp() {
  return (
    <PortalFrame title="" active="/assets">
      {/* Custom header: breadcrumb */}
      <div style={{ padding: "14px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
          <span>Brand Assets</span>
          <Icon.Chevron size={12} />
          <span>Logo System</span>
          <Icon.Chevron size={12} />
          <span style={{ color: C.fg, fontWeight: 500 }}>Primary Mark</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: C.subtle }}>Last viewed 3 days ago</span>
        </div>
        {/* Recently viewed chip row */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", overflow: "hidden" }}>
          <span style={{ fontSize: 10, color: C.subtle, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, whiteSpace: "nowrap" }}>Recently viewed</span>
          {[
            { i: Icon.FileText, t: "SOW v3 — Lumen × RBRANDR" },
            { i: Icon.Image, t: "Spring hero 03" },
            { i: Icon.Scroll, t: "Social T&Cs" },
            { i: Icon.Chart, t: "March report" },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, whiteSpace: "nowrap" }}>
              <x.i size={12} /> {x.t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, height: "calc(100% - 80px)", overflow: "hidden" }}>
        {/* Preview */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, background: `radial-gradient(circle at 30% 30%, ${C.accent}22, transparent 60%), ${C.surface2}`, display: "grid", placeItems: "center", position: "relative" }}>
            <div style={{ fontSize: 140, fontWeight: 900, color: C.accent, letterSpacing: -8 }}>L</div>
            <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6 }}>
              {["SVG","PNG","PDF","EPS"].map(x => (
                <span key={x} style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", padding: "3px 8px", background: "rgba(0,0,0,.6)", borderRadius: 4, color: C.muted }}>{x}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <button style={btn(true)}>Download pack</button>
            <button style={btn()}>Copy URL</button>
            <div style={{ flex: 1 }} />
            {/* Contextual help trigger */}
            <div style={{ position: "relative" }}>
              <button style={{ ...btn(), display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Help size={13}/> When to use this
              </button>
              {/* Popover */}
              <div style={{ position: "absolute", right: 0, bottom: "calc(100% + 10px)", width: 300, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: "0 20px 50px rgba(0,0,0,.5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: C.accent }}><Icon.Sparkles size={14} /></span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Primary mark — quick guide</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
                  Use for dark-on-light surfaces, min. 24px high. For small icons and favicons, grab the <span style={{ color: C.accent, textDecoration: "underline", textDecorationColor: C.accent + "77" }}>monogram</span> instead.
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderSub}`, display: "flex", justifyContent: "space-between", fontSize: 10, color: C.subtle }}>
                  <span>From: Brand Guidelines · p. 4</span>
                  <span style={{ color: C.accent }}>Open full guide →</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Meta panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600, marginBottom: 10 }}>Details</div>
            {[
              ["Version", "2.3 · current"],
              ["Uploaded by", "RBRANDR Team"],
              ["Added", "Apr 4, 2026"],
              ["Usage rights", "All channels"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 12, borderBottom: `1px solid ${C.borderSub}` }}>
                <span style={{ color: C.subtle }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600, marginBottom: 12 }}>Related</div>
            {[
              { i: Icon.Image, t: "Monogram", s: "3 formats" },
              { i: Icon.Image, t: "Horizontal lockup", s: "4 formats" },
              { i: Icon.Book, t: "Brand Guidelines", s: "28 pages" },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 2 ? `1px solid ${C.borderSub}` : "none" }}>
                <span style={{ color: C.muted }}><x.i size={14} /></span>
                <span style={{ flex: 1, fontSize: 12 }}>{x.t}</span>
                <span style={{ fontSize: 10, color: C.subtle }}>{x.s}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PortalFrame>
  );
}
const btn = (primary) => ({
  padding: "8px 12px", fontSize: 12, fontWeight: primary ? 600 : 500, borderRadius: 7,
  background: primary ? C.accent : C.surface2, color: primary ? "white" : C.fg,
  border: `1px solid ${primary ? C.accent : C.border}`, cursor: "pointer",
});

/* =================================================================
   ENHANCEMENT 6 — Inline Approval Ribbon (one-click approve)
   ================================================================= */
function ApprovalRibbon() {
  return (
    <PortalFrame title="Content Calendar" subtitle="Week of April 20" active="/calendar">
      <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
        {/* Summary ribbon */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: `linear-gradient(90deg, ${C.accent}15, ${C.accentPurple}10)`, border: `1px solid ${C.accent}33`, display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentSub, display: "grid", placeItems: "center", color: C.accent }}>
            <Icon.Check size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>3 posts waiting for your approval</div>
            <div style={{ fontSize: 11, color: C.muted }}>Earliest goes live Friday 10:00 AM · Review inline below or sweep approve</div>
          </div>
          <button style={{ ...btn(false), display: "flex", alignItems: "center", gap: 6 }}>Skim all <Icon.Eye size={12}/></button>
          <button style={btn(true)}>Approve all 3</button>
        </div>

        {/* Post cards with inline approve */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { ch: "Instagram", when: "Fri · 10:00", title: "Spring collection drop", approved: false, hl: true, bg: `linear-gradient(135deg, #3a1a2e, #1a0f1e)` },
            { ch: "TikTok",    when: "Sat · 18:00", title: "Behind the shoot · reel", approved: false, hl: false, bg: `linear-gradient(135deg, #1a2a3a, #0f1a1e)` },
            { ch: "LinkedIn",  when: "Mon · 09:00", title: "Founder note — Q2 vision", approved: false, hl: false, bg: `linear-gradient(135deg, #2a2a1a, #1a1e0f)` },
          ].map((x, i) => (
            <Card key={i} style={{ overflow: "hidden", padding: 0, borderColor: x.hl ? C.accent + "4D" : C.border }}>
              <div style={{ aspectRatio: "1/1", background: x.bg, position: "relative", display: "grid", placeItems: "center", color: C.subtle }}>
                <Icon.Image size={32} />
                <span style={{ position: "absolute", top: 10, left: 10, fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,.6)", color: C.fg, fontWeight: 600 }}>{x.ch}</span>
                <span style={{ position: "absolute", top: 10, right: 10, fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,.6)", color: C.muted, fontFamily: "ui-monospace, monospace" }}>{x.when}</span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{x.title}</div>
                <div style={{ fontSize: 11, color: C.subtle, lineHeight: 1.5, marginBottom: 12 }}>Caption, 4 hashtags, and 2 alt text variations attached.</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 600, borderRadius: 7, background: C.accent, color: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Icon.Check size={13}/> Approve
                  </button>
                  <button style={{ padding: "8px 10px", fontSize: 12, borderRadius: 7, background: C.surface2, color: C.fg, border: `1px solid ${C.border}` }}>Comment</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PortalFrame>
  );
}

/* =================================================================
   ENHANCEMENT 7 — Breadcrumbs + Page progress bar (navigation polish)
   Using unified "Today" feed as a lightweight unified inbox
   ================================================================= */
function UnifiedInbox() {
  const feed = [
    { when: "2h ago",  type: "approval", from: "Sara (RBRANDR)", t: "Requested approval on 3 posts", body: "Spring drop campaign · Instagram, TikTok, LinkedIn", i: Icon.Check, urgent: true },
    { when: "5h ago",  type: "upload",   from: "RBRANDR Team",    t: "Uploaded 12 new brand assets",    body: "Logo system v2.3 · Primary, mono, wordmark, lockups", i: Icon.Upload },
    { when: "Yesterday", type: "comment",from: "Marcus (RBRANDR)", t: "Replied on ticket #241",         body: "“We've pushed the hero section to staging — take a look when you get a sec.”", i: Icon.Msg },
    { when: "Yesterday", type: "milestone", from: "Timeline",      t: "Brand discovery complete",       body: "Phase 1 of 3 · next: visual exploration", i: Icon.Milestone },
    { when: "2 days ago", type: "doc",  from: "Contracts",         t: "SOW v3 ready for signature",     body: "Electronic signature · 2 min · expires May 1", i: Icon.Scroll, urgent: true },
  ];
  return (
    <PortalFrame title="Activity" subtitle="Everything across your project, in one place" active="/dashboard">
      {/* Top page progress */}
      <div style={{ height: 2, background: C.border, position: "relative" }}>
        <div style={{ width: "62%", height: "100%", background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
      </div>
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, height: "calc(100% - 2px)", overflow: "hidden" }}>
        {/* filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { l: "Everything", c: 14, active: true },
            { l: "Approvals", c: 3, dot: true },
            { l: "Uploads", c: 5 },
            { l: "Comments", c: 4 },
            { l: "Milestones", c: 2 },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 7, background: x.active ? C.surface : "transparent", border: `1px solid ${x.active ? C.border : "transparent"}`, fontSize: 12, fontWeight: 500, color: x.active ? C.fg : C.muted }}>
              {x.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }}/>}
              <span style={{ flex: 1 }}>{x.l}</span>
              <span style={{ fontSize: 10, color: C.subtle, fontFamily: "ui-monospace, monospace" }}>{x.c}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.borderSub}`, margin: "10px 0" }}/>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.subtle, fontWeight: 600, padding: "0 11px", marginBottom: 4 }}>Pinned</div>
          {["SOW signature", "Spring approvals"].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", fontSize: 11, color: C.muted }}>
              <Icon.Pin size={11}/> {x}
            </div>
          ))}
        </div>
        {/* feed */}
        <div style={{ overflow: "auto", paddingRight: 4 }}>
          {feed.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < feed.length - 1 ? `1px solid ${C.borderSub}` : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: x.urgent ? C.accentSub : C.surface2, border: `1px solid ${x.urgent ? C.accent + "4D" : C.border}`, display: "grid", placeItems: "center", color: x.urgent ? C.accent : C.muted, flexShrink: 0 }}>
                <x.i size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{x.t}</span>
                  <span style={{ fontSize: 10, color: C.subtle }}>by {x.from}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.subtle }}>{x.when}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{x.body}</div>
                {x.urgent && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, background: C.accent, color: "white", border: "none" }}>
                      {x.type === "approval" ? "Review posts" : "Sign document"}
                    </button>
                    <button style={{ padding: "5px 10px", fontSize: 11, borderRadius: 6, background: "transparent", color: C.muted, border: `1px solid ${C.border}` }}>Later</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalFrame>
  );
}

/* =================================================================
   ENHANCEMENT 8 — "What's new" drawer (onboarding + changelog)
   ================================================================= */
function WhatsNewDrawer() {
  return (
    <PortalFrame title="Dashboard" subtitle="Welcome back, Dean">
      <div style={{ padding: 24, height: "100%", display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, overflow: "hidden" }}>
        {/* fake dashboard behind */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "min-content", gap: 14, opacity: 0.55 }}>
          {[0,1,2,3].map(i => (
            <Card key={i} style={{ padding: 18, height: 140 }}>
              <div style={{ height: 10, width: 80, background: C.border, borderRadius: 3, marginBottom: 14 }}/>
              <div style={{ height: 28, width: 60, background: C.border, borderRadius: 4, marginBottom: 12 }}/>
              <div style={{ height: 6, width: "80%", background: C.borderSub, borderRadius: 3, marginBottom: 6 }}/>
              <div style={{ height: 6, width: "60%", background: C.borderSub, borderRadius: 3 }}/>
            </Card>
          ))}
        </div>

        {/* drawer */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.accent }}><Icon.Sparkles size={16}/></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>What's new</div>
              <div style={{ fontSize: 10, color: C.subtle }}>3 updates since you last visited</div>
            </div>
            <button style={{ fontSize: 16, color: C.subtle, background: "transparent", border: "none" }}>×</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {[
              { tag: "New", tagC: C.accent, t: "One-click post approvals", body: "Skim the week and approve with a single tap from the calendar or the new Activity page.", when: "Today" },
              { tag: "Improved", tagC: C.muted, t: "Faster asset preview", body: "Thumbnails now load instantly. Filetype badges show up-front so you know before you click.", when: "Tuesday" },
              { tag: "New", tagC: C.accent, t: "Press ⌘K to jump anywhere", body: "Command palette is live across the portal. Search files, jump to pages, trigger actions.", when: "Last week" },
            ].map((x, i) => (
              <div key={i} style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderSub}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: x.tagC === C.accent ? C.accentSub : C.surface2, color: x.tagC, border: `1px solid ${x.tagC === C.accent ? C.accent + "4D" : C.border}` }}>{x.tag}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{x.t}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{x.body}</div>
                <div style={{ fontSize: 10, color: C.subtle, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon.Clock size={10}/> {x.when}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <button style={{ ...btn(false), flex: 1 }}>See all updates</button>
            <button style={btn(true)}>Got it</button>
          </div>
        </Card>
      </div>
    </PortalFrame>
  );
}

/* ---------- expose ---------- */
Object.assign(window, {
  CommandPalette, NeedsYouCard, SearchTopbar,
  EmptyStates, ContextualHelp, ApprovalRibbon,
  UnifiedInbox, WhatsNewDrawer,
});
