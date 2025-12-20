import { showStatusMessage, hideStatusSpinner } from "./ui.js";
import { els } from "./dom.js";
import { state } from "./state.js";

const STRAVA_BUTTON_IMG = `<img src="/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />`;
const LOGOUT_BUTTON_LABEL = "Log out";
const POLL_INTERVAL_MS = 2500;

function setConnectAttention(active) {
  if (!els.connect) return;
  els.connect.classList.toggle("need-auth", Boolean(active));
}

function renderConnectButton(authenticated) {
  if (!els.connect) return;
  if (authenticated) {
    els.connect.classList.remove("btn-strava");
    els.connect.classList.add("btn-logout");
    els.connect.textContent = LOGOUT_BUTTON_LABEL;
    els.connect.setAttribute("aria-label", "Log out and clear stored data");
  } else {
    els.connect.classList.add("btn-strava");
    els.connect.classList.remove("btn-logout");
    els.connect.innerHTML = STRAVA_BUTTON_IMG;
    els.connect.setAttribute("aria-label", "Connect with Strava");
  }
}

export function updateAuthUI(authenticated) {
  state.isAuthenticated = authenticated;
  renderConnectButton(authenticated);
  setConnectAttention(!authenticated);
}

export function handleAuthRequired(message) {
  updateAuthUI(false);
  showStatusMessage(
    message || "Connect Strava to load your activities.",
    "var(--muted)"
  );
}

export async function ensureSessionCookie() {
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json().catch(() => ({}));
}

export async function checkAuthStatus() {
  try {
    const res = await fetch("/api/token", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

function stopAuthPolling() {
  if (state.authPollTimer) {
    clearInterval(state.authPollTimer);
    state.authPollTimer = null;
  }
}

function startAuthPolling(onAuthenticated) {
  if (state.authPollTimer) return;
  state.authPollTimer = window.setInterval(async () => {
    const authed = await checkAuthStatus();
    if (authed) {
      stopAuthPolling();
      updateAuthUI(true);
      hideStatusSpinner();
      onAuthenticated?.();
    }
  }, POLL_INTERVAL_MS);
}

function startAuthFlow(event, onAuthenticated) {
  event?.preventDefault();
  const popup = window.open(
    "/api/start",
    "strava-auth",
    "width=640,height=760"
  );
  showStatusMessage(
    "Complete the authentication popup, then return here.",
    "var(--muted)"
  );
  if (popup) {
    popup.focus();
    startAuthPolling(onAuthenticated);
  } else {
    window.location.href = "/api/start";
  }
}

async function handleLogout(event, onLogout) {
  event?.preventDefault();
  showStatusMessage("Logging out and clearing your data...", "var(--muted)");
  try {
    const res = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    updateAuthUI(false);
    showStatusMessage("Logged out and removed stored data.", "var(--muted)");
  } catch (err) {
    console.error("Logout failed:", err);
    showStatusMessage(err.message || "Failed to log out.", "var(--error)");
  } finally {
    stopAuthPolling();
    onLogout?.();
    state.displayActivities = [];
    state.allActivities = [];
    state.expandedActivities.clear();
    state.currentPage = 1;
  }
}

export function bindConnectButton({ onAuthenticated, onLogout }) {
  if (!els.connect) return;
  renderConnectButton(false);
  els.connect.addEventListener("click", (event) => {
    if (state.isAuthenticated) {
      handleLogout(event, onLogout);
    } else {
      startAuthFlow(event, onAuthenticated);
    }
  });
}
