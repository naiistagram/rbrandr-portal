import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * MFA is mandatory for the portal. A user needs both a verified TOTP factor
 * and an AAL2 session, which is granted after completing its challenge.
 */
export async function getMfaStatus(supabase: SupabaseClient) {
  const [{ data: sessionData }, factorsResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (factorsResult.error) {
    return { requiresMfa: true, error: factorsResult.error };
  }

  const assuranceResult = sessionData.session
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
        sessionData.session.access_token
      )
    : { data: null, error: new Error("No active session.") };

  if (assuranceResult.error || !assuranceResult.data) {
    return { requiresMfa: true, error: assuranceResult.error ?? new Error("Unable to verify MFA status.") };
  }

  const hasVerifiedTotp = factorsResult.data.totp.length > 0;

  return {
    requiresMfa: !hasVerifiedTotp || assuranceResult.data.currentLevel !== "aal2",
    error: null,
  };
}
