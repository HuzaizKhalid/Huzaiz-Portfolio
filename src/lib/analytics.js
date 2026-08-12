/**
 * Portfolio analytics — fire-and-forget event tracking.
 *
 * Events are POSTed to the admin dashboard's /api/track endpoint, which records
 * them in Supabase and surfaces them at /dashboard/analytics.
 *
 * DESIGN NOTES
 * ────────────
 * · Never blocks or breaks the UI. Every failure path is swallowed — analytics
 *   must never stop a visitor from opening a project or downloading the CV.
 * · Uses navigator.sendBeacon where available, with a text/plain body. That is
 *   the only content type that avoids a CORS preflight, and a beacon fired as
 *   the page unloads (clicking an external link) cannot survive one.
 * · No cookies and no client-side identifiers. The server derives a
 *   daily-rotating salted hash for unique-visitor counts.
 */

const ENDPOINT = import.meta.env.VITE_ADMIN_API_URL
  ? `${import.meta.env.VITE_ADMIN_API_URL.replace(/\/$/, "")}/api/track`
  : null;

const PAGEVIEW_SESSION_KEY = "hz_pageview_sent";

let warnedMissingEndpoint = false;

/** Honour Global Privacy Control — a legally recognised opt-out signal. */
function hasOptedOut() {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}

function isEnabled() {
  if (typeof window === "undefined") return false;
  if (hasOptedOut()) return false;

  if (!ENDPOINT) {
    if (!warnedMissingEndpoint) {
      warnedMissingEndpoint = true;
      console.info(
        "[analytics] VITE_ADMIN_API_URL is not set — event tracking is disabled."
      );
    }
    return false;
  }
  return true;
}

/**
 * Records one event.
 *
 * @param {'pageview'|'project_click'|'resume_download'|'contact_click'} event
 * @param {{ target?: string, path?: string }} [details]
 */
export function track(event, details = {}) {
  if (!isEnabled()) return;

  const body = JSON.stringify({
    event,
    target: details.target ?? null,
    path: details.path ?? `${window.location.pathname}${window.location.hash}`,
    // The server keeps only the hostname of this — never the full URL.
    referrer: document.referrer || null,
  });

  try {
    // text/plain keeps this a "simple" CORS request: no preflight, so it still
    // goes through when the page is being torn down.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    // Fallback for browsers without sendBeacon, or when the beacon queue is full.
    fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Analytics is never allowed to surface an error to the visitor.
  }
}

/**
 * Records a pageview once per browser session.
 *
 * This is a single-page site, so without the guard a React StrictMode double
 * render (or any remount) would double-count the same visit.
 */
export function trackPageview() {
  if (!isEnabled()) return;

  try {
    if (sessionStorage.getItem(PAGEVIEW_SESSION_KEY)) return;
    sessionStorage.setItem(PAGEVIEW_SESSION_KEY, "1");
  } catch {
    // Private mode can throw on sessionStorage — fall through and count it.
  }

  track("pageview");
}

// ── Convenience wrappers, so components read declaratively ──────────────────

export const trackProjectClick = (title) =>
  track("project_click", { target: title || "Untitled project" });

export const trackResumeDownload = () =>
  track("resume_download", { target: "CV" });

export const trackContactClick = (channel) =>
  track("contact_click", { target: channel });
