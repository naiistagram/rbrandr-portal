import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SocialProvider = "meta" | "linkedin";

type OAuthState = {
  provider: SocialProvider;
  projectId: string;
  returnTo: string;
  expiresAt: number;
};

function getStateSecret() {
  const secret = process.env.SOCIAL_OAUTH_STATE_SECRET ?? process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SOCIAL_OAUTH_STATE_SECRET is not configured.");
  return secret;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", getStateSecret()).update(value).digest("base64url");
}

export function createOAuthState(state: OAuthState) {
  const payload = encode(JSON.stringify(state));
  return `${payload}.${sign(payload)}`;
}

export function readOAuthState(value: string | null, provider: SocialProvider) {
  if (!value) throw new Error("Missing OAuth state.");
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) throw new Error("Invalid OAuth state.");
  const expectedSignature = sign(payload);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid OAuth state.");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  if (state.provider !== provider || state.expiresAt < Date.now() || !state.projectId || !state.returnTo.startsWith("/admin/clients/")) {
    throw new Error("OAuth session has expired. Please try again.");
  }
  return state;
}

export function socialAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return appUrl.replace(/\/$/, "");
}

export async function getVerifiedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? { admin, user } : null;
}

export function configuredProvider(provider: SocialProvider) {
  if (provider === "meta") return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}
