"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Building2, Crosshair, Plus, Tag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_INSTAGRAM_TAGS,
  mentionToken,
  type ContentTag,
  type SocialPerson,
  type TagPlatform,
} from "@/lib/social-tagging";

type DraftTag = Pick<ContentTag, "social_person_id" | "platform" | "media_index" | "x" | "y"> & Partial<Pick<ContentTag, "status" | "error_message" | "display_name">>;

function toDraft(tag: ContentTag): DraftTag {
  return {
    social_person_id: tag.social_person_id,
    platform: tag.platform,
    media_index: tag.media_index,
    x: tag.x === null ? null : Number(tag.x),
    y: tag.y === null ? null : Number(tag.y),
    status: tag.status,
    error_message: tag.error_message,
    display_name: tag.display_name,
  };
}

/**
 * Loads and saves the people tagged on one content item. Every change is
 * saved straight away, like the publishing-channel checkboxes beside it.
 *
 * In draft mode (the New Content form, before the item exists) tags are only
 * held in memory; call persist(newContentId) once the item has been created.
 */
export function useContentTags(contentId: string | null, options: { draft?: boolean } = {}) {
  const draft = Boolean(options.draft);
  const [people, setPeople] = useState<SocialPerson[]>([]);
  const [tags, setTags] = useState<DraftTag[]>([]);
  const [loading, setLoading] = useState(Boolean(contentId) || draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [placingPersonId, setPlacingPersonId] = useState<string | null>(null);
  const latestContentId = useRef(contentId);
  const [loadedFor, setLoadedFor] = useState(contentId);

  // Opening a different item starts from a clean slate (adjusting state
  // during render, rather than in an effect, avoids a flash of stale tags).
  if (loadedFor !== contentId) {
    setLoadedFor(contentId);
    setTags([]);
    setError("");
    setPlacingPersonId(null);
    setLoading(Boolean(contentId));
  }

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    fetch("/api/admin/social-people?view=directory", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setUnavailable(json.error ?? "");
        setPeople(json.people ?? []);
      })
      .catch(() => { if (!cancelled) setError("Could not load people."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [draft]);

  useEffect(() => {
    latestContentId.current = contentId;
    if (!contentId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/content-tags?contentId=${encodeURIComponent(contentId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/social-people?view=directory", { cache: "no-store" }).then((res) => res.json()),
    ]).then(([tagJson, peopleJson]) => {
      if (cancelled) return;
      setUnavailable(tagJson.unavailable ?? peopleJson.error ?? "");
      setTags((tagJson.tags ?? []).map(toDraft));
      setPeople(peopleJson.people ?? []);
    }).catch(() => {
      if (!cancelled) setError("Could not load tags.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contentId]);

  const save = useCallback(async (next: DraftTag[]) => {
    if (draft) { setTags(next); setError(""); return true; }
    if (!contentId) return false;
    const previous = tags;
    setTags(next);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/content-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, tags: next.map(({ social_person_id, platform, media_index, x, y }) => ({ social_person_id, platform, media_index, x, y })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save tags.");
      if (latestContentId.current === contentId) setTags((json.tags ?? []).map(toDraft));
      return true;
    } catch (saveError) {
      if (latestContentId.current === contentId) {
        setTags(previous);
        setError(saveError instanceof Error ? saveError.message : "Could not save tags.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [contentId, draft, tags]);

  /** Draft mode: saves the held tags onto a newly created item. Returns an error message, or null. */
  const persist = useCallback(async (newContentId: string) => {
    if (!tags.length) return null;
    try {
      const res = await fetch("/api/admin/content-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: newContentId, tags: tags.map(({ social_person_id, platform, media_index, x, y }) => ({ social_person_id, platform, media_index, x, y })) }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok ? null : (json.error ?? "Could not save tags.");
    } catch {
      return "Could not save tags.";
    }
  }, [tags]);

  /** Draft mode: clears the held tags (after saving or cancelling the form). */
  const reset = useCallback(() => {
    setTags([]);
    setError("");
    setPlacingPersonId(null);
  }, []);

  /** Called by the image overlay when the admin clicks where the person is. */
  const placeOnImage = useCallback((mediaIndex: number, x: number, y: number) => {
    if (!placingPersonId) return;
    const next = tags.map((tag) => tag.social_person_id === placingPersonId && tag.platform === "Instagram"
      ? { ...tag, media_index: mediaIndex, x, y }
      : tag);
    setPlacingPersonId(null);
    void save(next);
  }, [placingPersonId, save, tags]);

  const addPerson = useCallback((person: SocialPerson) => {
    setPeople((current) => current.some((item) => item.id === person.id) ? current : [...current, person].sort((a, b) => a.display_name.localeCompare(b.display_name)));
  }, []);

  return { people, addPerson, tags, save, persist, reset, loading, saving, error, setError, unavailable, placingPersonId, setPlacingPersonId, placeOnImage };
}

export type ContentTagsState = ReturnType<typeof useContentTags>;

/**
 * Wraps the preview image: shows Instagram tag markers and, while placing a
 * tag, turns a click into a position on the image.
 */
export function TaggableImage({ src, alt, mediaIndex, state }: { src: string; alt: string; mediaIndex: number; state: ContentTagsState }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const peopleById = useMemo(() => new Map(state.people.map((person) => [person.id, person])), [state.people]);
  const markers = state.tags.filter((tag) => tag.platform === "Instagram" && tag.media_index === mediaIndex && tag.x !== null && tag.y !== null);
  const placing = Boolean(state.placingPersonId);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    state.placeOnImage(mediaIndex, x, y);
  }

  return (
    <div className={cn("relative inline-block", placing && "cursor-crosshair")} onClick={handleClick}>
      <img ref={imageRef} src={src} alt={alt} className="max-w-full max-h-[480px] object-contain block" />
      {markers.map((tag) => {
        const person = tag.social_person_id ? peopleById.get(tag.social_person_id) : undefined;
        return (
          <span
            key={`${tag.social_person_id}-${tag.platform}`}
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ left: `${(tag.x ?? 0) * 100}%`, top: `${(tag.y ?? 0) * 100}%` }}
          >
            <span className="block rounded-md bg-black/80 px-2 py-1 text-[11px] font-semibold text-white shadow-lg whitespace-nowrap">
              @{person?.instagram_username ?? tag.display_name}
            </span>
            <span className="mx-auto block h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-black/80" />
          </span>
        );
      })}
      {placing && (
        <span className="absolute inset-x-0 top-0 bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-semibold text-white pointer-events-none">
          Click on the person in the photo
        </span>
      )}
    </div>
  );
}

function PlatformToggle({ active, available, label, onClick, disabled, title }: { active: boolean; available: boolean; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !available}
      title={title}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed",
        active ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground-subtle)]",
        !available && "opacity-40",
      )}
    >
      {label}
    </button>
  );
}

function StatusPill({ tag }: { tag: DraftTag | undefined }) {
  if (!tag?.status || tag.status === "pending") return null;
  return (
    <span title={tag.error_message ?? undefined} className={cn("text-[10px] font-semibold", tag.status === "published" ? "text-emerald-400" : "text-red-400")}>
      {tag.status === "published" ? "✓ Tagged" : "× Not tagged"}
    </span>
  );
}

const inputClass = "w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-xs outline-none focus:border-[var(--accent)] transition-all";

export function ContentTagPanel({
  state,
  platforms,
  imageIndexes,
  currentMediaIndex,
  locked,
  onInsertMention,
}: {
  state: ContentTagsState;
  /** Platforms selected on the content item. */
  platforms: string[];
  /** Indexes of attachments that are images, the only media Instagram can tag. */
  imageIndexes: number[];
  currentMediaIndex: number;
  locked: boolean;
  onInsertMention: (token: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newPerson, setNewPerson] = useState({ display_name: "", kind: "person" as SocialPerson["kind"], instagram_username: "", linkedin: "" });
  const [creating, setCreating] = useState(false);
  const wantsInstagram = platforms.includes("Instagram");
  const wantsLinkedIn = platforms.includes("LinkedIn");
  const peopleById = useMemo(() => new Map(state.people.map((person) => [person.id, person])), [state.people]);
  const taggedIds = [...new Set(state.tags.map((tag) => tag.social_person_id).filter((id): id is string => Boolean(id)))];
  const instagramCount = state.tags.filter((tag) => tag.platform === "Instagram").length;
  const disabled = locked || state.saving;
  const firstImageIndex = imageIndexes[0] ?? 0;

  // Clicking into the search box lists everyone; typing narrows the list.
  const search = query.trim().toLowerCase();
  const matches = searchOpen
    ? state.people.filter((person) => !taggedIds.includes(person.id) && (!search || [person.display_name, person.instagram_username ?? "", person.linkedin_name ?? ""].some((value) => value.toLowerCase().includes(search)))).slice(0, search ? 8 : 50)
    : [];

  function tagsFor(person: SocialPerson) {
    const next: DraftTag[] = [];
    const mediaIndex = imageIndexes.includes(currentMediaIndex) ? currentMediaIndex : firstImageIndex;
    if (wantsInstagram && person.instagram_username && imageIndexes.length && instagramCount < MAX_INSTAGRAM_TAGS) {
      next.push({ social_person_id: person.id, platform: "Instagram", media_index: mediaIndex, x: 0.5, y: 0.5 });
    }
    if (wantsLinkedIn && person.linkedin_urn) next.push({ social_person_id: person.id, platform: "LinkedIn", media_index: 0, x: null, y: null });
    return next;
  }

  async function tagPerson(person: SocialPerson) {
    setQuery("");
    setSearchOpen(false);
    const next = tagsFor(person);
    if (!next.length) {
      const reasons = [
        !wantsInstagram && !wantsLinkedIn ? "select Instagram or LinkedIn as a platform first" : "",
        wantsInstagram && !person.instagram_username ? "no Instagram username saved" : "",
        wantsInstagram && person.instagram_username && !imageIndexes.length ? "Instagram photo tags need an image attachment" : "",
        wantsLinkedIn && !person.linkedin_urn ? (person.kind === "person" ? "they haven't connected LinkedIn yet" : "no LinkedIn company ID saved") : "",
      ].filter(Boolean);
      state.setError(`Can't tag ${person.display_name}: ${reasons.join("; ")}.`);
      return;
    }
    const saved = await state.save([...state.tags, ...next]);
    if (saved && next.some((tag) => tag.platform === "Instagram")) state.setPlacingPersonId(person.id);
  }

  function togglePlatform(person: SocialPerson, platform: TagPlatform) {
    const existing = state.tags.find((tag) => tag.social_person_id === person.id && tag.platform === platform);
    if (existing) {
      if (state.placingPersonId === person.id && platform === "Instagram") state.setPlacingPersonId(null);
      void state.save(state.tags.filter((tag) => tag !== existing));
      return;
    }
    const added = tagsFor(person).filter((tag) => tag.platform === platform);
    if (added.length) void state.save([...state.tags, ...added]);
  }

  function removePerson(personId: string) {
    if (state.placingPersonId === personId) state.setPlacingPersonId(null);
    void state.save(state.tags.filter((tag) => tag.social_person_id !== personId));
  }

  async function createPerson() {
    if (!newPerson.display_name.trim()) { state.setError("Add a name."); return; }
    setCreating(true);
    state.setError("");
    try {
      let linkedinUrn: string | null = null;
      let linkedinName: string | null = null;
      if (newPerson.kind === "organization" && newPerson.linkedin.trim()) {
        const value = newPerson.linkedin.trim();
        if (/^\d+$/.test(value) || /^urn:li:organization:/.test(value) || /linkedin\.com\/company\/\d+/i.test(value)) {
          linkedinUrn = value;
        } else {
          const lookup = await fetch("/api/admin/social-people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lookup_linkedin_org", value }) });
          const lookupJson = await lookup.json();
          if (!lookup.ok) throw new Error(lookupJson.error ?? "Could not find that LinkedIn company.");
          linkedinUrn = lookupJson.organization.urn;
          linkedinName = lookupJson.organization.name;
        }
      }
      const res = await fetch("/api/admin/social-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: newPerson.display_name,
          kind: newPerson.kind,
          instagram_username: newPerson.instagram_username || null,
          linkedin_urn: linkedinUrn,
          linkedin_name: linkedinName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save this person.");
      state.addPerson(json.person);
      setShowNew(false);
      setNewPerson({ display_name: "", kind: "person", instagram_username: "", linkedin: "" });
      await tagPerson(json.person);
    } catch (createError) {
      state.setError(createError instanceof Error ? createError.message : "Could not save this person.");
    } finally {
      setCreating(false);
    }
  }

  if (state.unavailable) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11px] text-[var(--foreground-subtle)]">
        <p className="font-semibold text-[var(--foreground-muted)] flex items-center gap-1.5"><Tag className="w-3 h-3" /> Tag people</p>
        <p className="mt-1">{state.unavailable}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-[var(--accent)]" /> Tag people</p>
        {state.saving && <span className="text-[10px] text-[var(--foreground-subtle)]">Saving…</span>}
      </div>
      <p className="text-[10px] text-[var(--foreground-subtle)]">
        Instagram: tagged in the photo. LinkedIn: @mentioned in the post text (LinkedIn has no photo tags for apps).
        {locked && " This item has been published, so its tags are now a record of who was tagged."}
      </p>
      {!wantsInstagram && !wantsLinkedIn && <p className="text-[10px] text-amber-300">Select Instagram or LinkedIn as a platform to tag people.</p>}

      {state.loading ? (
        <p className="text-[11px] text-[var(--foreground-subtle)]">Loading tags…</p>
      ) : (
        <div className="space-y-1.5">
          {taggedIds.map((personId) => {
            const person = peopleById.get(personId);
            const instagramTag = state.tags.find((tag) => tag.social_person_id === personId && tag.platform === "Instagram");
            const linkedInTag = state.tags.find((tag) => tag.social_person_id === personId && tag.platform === "LinkedIn");
            const name = person?.display_name ?? instagramTag?.display_name ?? linkedInTag?.display_name ?? "Removed person";
            return (
              <div key={personId} className={cn("rounded-md border bg-[var(--surface)] px-2.5 py-2 text-xs", state.placingPersonId === personId ? "border-[var(--accent)]" : "border-[var(--border)]")}>
                <div className="flex items-center gap-2">
                  {person?.kind === "organization" ? <Building2 className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" /> : <User className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />}
                  <span className="flex-1 truncate font-medium text-[var(--foreground)]">{name}</span>
                  {!locked && (
                    <button type="button" onClick={() => removePerson(personId)} disabled={disabled} className="text-[var(--foreground-subtle)] hover:text-red-400 cursor-pointer" aria-label={`Remove ${name}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {person && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {wantsInstagram && (
                      <PlatformToggle
                        active={Boolean(instagramTag)}
                        available={Boolean(person.instagram_username && imageIndexes.length) || Boolean(instagramTag)}
                        label={person.instagram_username ? `IG @${person.instagram_username}` : "IG: no username"}
                        onClick={() => togglePlatform(person, "Instagram")}
                        disabled={disabled}
                      />
                    )}
                    {wantsLinkedIn && (
                      <PlatformToggle
                        active={Boolean(linkedInTag)}
                        available={Boolean(person.linkedin_urn) || Boolean(linkedInTag)}
                        label={person.linkedin_urn ? "LinkedIn mention" : person.kind === "person" ? "LinkedIn: not connected" : "LinkedIn: no ID"}
                        title={person.linkedin_name ? `Mentions as “${person.linkedin_name}”` : undefined}
                        onClick={() => togglePlatform(person, "LinkedIn")}
                        disabled={disabled}
                      />
                    )}
                    {instagramTag && !locked && (
                      <button
                        type="button"
                        onClick={() => state.setPlacingPersonId(state.placingPersonId === personId ? null : personId)}
                        disabled={disabled}
                        className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        <Crosshair className="w-3 h-3" />
                        {state.placingPersonId === personId ? "Cancel placing" : instagramTag.media_index === firstImageIndex ? "Place on photo" : "Move to first image"}
                      </button>
                    )}
                    {!locked && (
                      <button type="button" onClick={() => onInsertMention(mentionToken(person))} className="flex items-center gap-1 text-[10px] font-medium text-[var(--foreground-muted)] hover:text-[var(--accent)] cursor-pointer">
                        <AtSign className="w-3 h-3" /> Add to caption
                      </button>
                    )}
                    <span className="ml-auto flex gap-2">
                      {instagramTag?.status && instagramTag.status !== "pending" && <span className="text-[10px] text-[var(--foreground-subtle)]">IG</span>}
                      <StatusPill tag={instagramTag} />
                      {linkedInTag?.status && linkedInTag.status !== "pending" && <span className="text-[10px] text-[var(--foreground-subtle)]">LI</span>}
                      <StatusPill tag={linkedInTag} />
                    </span>
                  </div>
                )}
                {instagramTag && instagramTag.media_index !== firstImageIndex && !locked && (
                  <p className="mt-1 text-[10px] text-amber-300">Instagram only publishes the first image, so this tag won&apos;t be sent from here.</p>
                )}
              </div>
            );
          })}
          {!taggedIds.length && <p className="text-[11px] text-[var(--foreground-subtle)]">Nobody tagged yet.</p>}
        </div>
      )}

      {!locked && (
        <>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); if (e.key === "Enter") { e.preventDefault(); if (matches[0]) void tagPerson(matches[0]); } }}
              placeholder="Choose or search people and companies to tag…"
              className={inputClass}
              disabled={disabled}
            />
            {searchOpen && !state.loading && !search && !matches.length && (
              <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">{state.people.length ? "Everyone in the directory is already tagged." : "Nobody saved yet. Add someone below."}</p>
            )}
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl">
                {matches.map((person) => (
                  <button key={person.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => tagPerson(person)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] cursor-pointer">
                    {person.kind === "organization" ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    <span className="flex-1 truncate text-[var(--foreground)]">{person.display_name}</span>
                    <span className="text-[10px] text-[var(--foreground-subtle)]">
                      {[person.instagram_username ? "IG" : "", person.linkedin_urn ? "LI" : ""].filter(Boolean).join(" · ") || "No handles"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {search && !matches.length && <p className="text-[10px] text-[var(--foreground-subtle)]">No match in the directory.</p>}

          {showNew ? (
            <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex gap-1.5">
                {(["person", "organization"] as const).map((kind) => (
                  <button key={kind} type="button" onClick={() => setNewPerson((p) => ({ ...p, kind }))} className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer", newPerson.kind === kind ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground-subtle)]")}>
                    {kind === "person" ? "Person" : "Company"}
                  </button>
                ))}
              </div>
              <input value={newPerson.display_name} onChange={(e) => setNewPerson((p) => ({ ...p, display_name: e.target.value }))} placeholder={newPerson.kind === "person" ? "Full name (as on LinkedIn)" : "Company name (as on LinkedIn)"} className={inputClass} />
              <input value={newPerson.instagram_username} onChange={(e) => setNewPerson((p) => ({ ...p, instagram_username: e.target.value }))} placeholder="Instagram username (public account)" className={inputClass} />
              {newPerson.kind === "organization" ? (
                <input value={newPerson.linkedin} onChange={(e) => setNewPerson((p) => ({ ...p, linkedin: e.target.value }))} placeholder="LinkedIn company page URL or numeric ID" className={inputClass} />
              ) : (
                <p className="text-[10px] text-[var(--foreground-subtle)]">To @mention a person on LinkedIn, they connect LinkedIn from their portal Settings page.</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={createPerson} disabled={creating} className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 cursor-pointer">{creating ? "Saving…" : "Save and tag"}</button>
                <button type="button" onClick={() => setShowNew(false)} className="px-2 text-[11px] text-[var(--foreground-subtle)] cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowNew(true)} className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline cursor-pointer">
              <Plus className="w-3 h-3" /> New person or company
            </button>
          )}
        </>
      )}
      {state.error && <p className="text-[11px] text-red-400">{state.error}</p>}
    </div>
  );
}
