"use client";

import { createContext, useContext } from "react";

export interface PortalUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

const PortalUserContext = createContext<PortalUser | null>(null);

export function PortalUserProvider({
  user,
  children,
}: {
  user: PortalUser;
  children: React.ReactNode;
}) {
  return <PortalUserContext.Provider value={user}>{children}</PortalUserContext.Provider>;
}

export function usePortalUser() {
  return useContext(PortalUserContext);
}
