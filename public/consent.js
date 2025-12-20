import { els } from "./dom.js";

export const COOKIE_CONSENT_KEY = "atlo_cookie_consent_v1";

function persistCookieChoice(value) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Ignore storage errors (e.g., Safari private mode)
  }
}

export function initCookieBanner() {
  if (!els.cookieBanner) {
    return Promise.resolve(false);
  }

  let stored = null;
  try {
    stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    stored = null;
  }

  if (stored === "accepted") {
    els.cookieBanner.hidden = true;
    return Promise.resolve(true);
  }

  els.cookieBanner.hidden = false;

  const privacyLink = els.cookieBanner.querySelector("a.ghost");
  if (privacyLink) {
    privacyLink.setAttribute("rel", "noreferrer");
  }

  return new Promise((resolve) => {
    const acceptHandler = () => {
      persistCookieChoice("accepted");
      els.cookieBanner.hidden = true;

      els.cookieAccept?.removeEventListener("click", acceptHandler);
      resolve(true);
    };

    els.cookieAccept?.addEventListener("click", acceptHandler);
  });
}

export function clearLocalStateForDev() {
  try {
    window.localStorage.clear();
  } catch {
    window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  }
}
