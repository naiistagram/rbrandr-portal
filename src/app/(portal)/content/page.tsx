"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { ContentClient } from "./content-client";
import type { ContentItem } from "@/lib/supabase/types";

export default function ContentPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const res = await fetch("/api/content");
      if (res.ok) {
        const json = await res.json();
        if (json.projectId) setProjectId(json.projectId);
        setItems(json.content ?? []);
      }
      setLoaded(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="All Content" subtitle="View all content across your project" userId={userId} />
      </div>
    );
  }

  return <ContentClient initialItems={items} initialProjectId={projectId} userId={userId} />;
}
