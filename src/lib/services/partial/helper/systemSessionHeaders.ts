// ==================================================
// System Session Header Helpers (Reusable)
// ==================================================

const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

// --------------------------------------------------
// PUBLIC API (NOT A REACT HOOK)
// --------------------------------------------------
export const renderSystemSessionHeaders = (): Record<string, string> => {
  // Qlex-specific skew_blanc_session_* cookies are NOT read here.
  // Heed/support pages use QuizNurse's authoritative HttpOnly session
  // (via credentials: "include" or useOptionalAuth()), not Qlex session state.
  // The proper x-casto-line / x-casto-badge headers for LexmaCasto calls
  // should be obtained server-side via getNurviaCastoSessionHeaders() if needed.
  return {};
};

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────






// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End by B.L.S.M.A.C -  The Winds Chase US !
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────