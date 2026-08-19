"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { ContractsClient } from "./contracts-client";
import type { Contract } from "@/lib/supabase/types";

export default function ContractsPage() {
  const supabase = createClient();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [userId, setUserId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts ?? []);
      }
      setLoaded(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Contracts" subtitle="Review and sign your agreements" userId={userId} />
      </div>
    );
  }

  return <ContractsClient initialContracts={contracts} userId={userId} />;
}
