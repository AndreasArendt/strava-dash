import { initMap, renderPolylines } from "./map.js";
import { showStatusMessage } from "./ui.js";
import { bindRangeButtons, applyRange, initRangePicker } from "./dateRange.js";
import {
  loadActivities,
  bindMapStyleButtons,
  bindSummaryStyleButtons,
  bindPaginationControls,
  bindListToggle,
  setActiveMapStyle,
  renderCurrentPage,
  setActiveActivitySummaryButton,
} from "./activities.js";
import {
  bindConnectButton,
  ensureSessionCookie,
  checkAuthStatus,
  updateAuthUI,
} from "./auth.js";
import { initCookieBanner /*, clearLocalStateForDev */ } from "./consent.js";
import { els } from "./dom.js";
import { state } from "./state.js";

function isLocalHost() {
  const hostname = window?.location?.hostname || "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

async function initMapInstance() {
  try {
    state.mapInstance = await initMap(els.map);
    return true;
  } catch (err) {
    console.error(err);
    showStatusMessage(err.message || "Failed to load the map.", "var(--error)");
    return false;
  }
}

async function handleAuthenticated() {
  if (!state.mapInstance) {
    const mapReady = await initMapInstance();
    if (!mapReady) return;
  }
  await loadActivities();
}

function handleLogoutCleanup() {
  state.displayActivities = [];
  state.allActivities = [];
  state.expandedActivities.clear();
  state.currentPage = 1;
  if (els.count) {
    els.count.textContent = "0";
  }
  renderCurrentPage();
  if (state.mapInstance) {
    renderPolylines(state.mapInstance, []);
  }
}

async function init() {
  if (isLocalHost()) {
    // Clear persisted state while working locally so changes are easy to test.
    // clearLocalStateForDev();
  }

  const consentGiven = await initCookieBanner();
  if (!consentGiven) {
    return;
  }

  els.connect?.classList.add("cookie-consent-given");

  bindRangeButtons(loadActivities);
  bindMapStyleButtons();
  bindSummaryStyleButtons();
  bindPaginationControls();
  bindListToggle();
  setActiveMapStyle(state.activeMapStyle);
  setActiveActivitySummaryButton(state.activeSummaryStyle);

  bindConnectButton({
    onAuthenticated: handleAuthenticated,
    onLogout: handleLogoutCleanup,
  });

  const hasSession = await ensureSessionCookie().catch((err) => {
    console.error("Failed to establish session:", err);
    showStatusMessage(
      "Unable to initialize your session. Reload the page and try again.",
      "var(--error)"
    );
    return false;
  });

  if (!hasSession) {
    return;
  }

  const mapReady = await initMapInstance();
  if (!mapReady) {
    return;
  }

  applyRange("year", loadActivities);
  initRangePicker(loadActivities);

  checkAuthStatus().then((authed) => {
    updateAuthUI(authed);
  });
}

init().catch((err) => {
  console.error(err);
  showStatusMessage("Failed to initialize the app.", "var(--error)");
});
