"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { TicketsClient } from "./tickets-client";
import type { Ticket as TicketType } from "@/lib/supabase/types";

export default function TicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const res = await fetch("/api/tickets");
      if (res.ok) {
        const json = await res.json();
        if (json.projectId) setProjectId(json.projectId);
        if (json.tickets) setTickets(json.tickets);
      }
      setLoaded(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Tickets" subtitle="Raise and track support issues" userId={userId} />
      </div>
    );
  }

  return <TicketsClient initialTickets={tickets} initialProjectId={projectId} userId={userId} />;
}
