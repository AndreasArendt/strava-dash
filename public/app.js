import { api } from "./api.js";
import {
  renderList,
  showStatusSpinner,
  hideStatusSpinner,
  showStatusMessage,
} from "./ui.js";
import {
  initMap,
  renderPolylines,
  applyMapStyle,
  DEFAULT_MAP_STYLE_ID,
} from "./map.js";

const els = {
  connect: document.getElementById("connect"),
  status: document.getElementById("status"),
  list: document.getElementById("list"),
  count: document.getElementById("count"),
  map: document.getElementById("map"),
  startDate: document.getElementById("start-date"),
  endDate: document.getElementById("end-date"),
  rangeLabel: document.getElementById("range-label"),
  quickButtons: document.querySelectorAll("[data-range]"),
  mapStyleButtons: document.querySelectorAll("[data-map-style]"),
  pagination: document.getElementById("activity-pagination"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageIndicator: document.getElementById("page-indicator"),
  rangePickerInput: document.getElementById("date-range-picker"),
  cookieBanner: document.getElementById("cookie-banner"),
  cookieAccept: document.getElementById("cookie-accept"),
  activityFilterButtons: document.getElementById('map-filter-buttons'),
};

let allActivities = [];
let displayActivities = [];
let currentActivityFilter = 'All';

let mapInstance;
let activeMapStyle = DEFAULT_MAP_STYLE_ID;
let authPollTimer = null;
const PAGE_SIZE = 10;
let currentPage = 1;
const expandedActivities = new Set();
let rangePickerInstance;
const AUTH_ERROR_PATTERN =
  /(Not authenticated|Missing session state|No token)/i;
const STRAVA_BUTTON_IMG = `<img src="/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />`;
const LOGOUT_BUTTON_LABEL = "Log out";
let isAuthenticated = false;
const COOKIE_CONSENT_KEY = "atlo_cookie_consent_v1";
let activityFilterHandlerBound = false;

const toInputValue = (date) => {
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().split("T")[0];
};

const formatRangeLabel = (start, end) => {
  const opts = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(
    undefined,
    opts
  )} → ${end.toLocaleDateString(undefined, opts)}`;
};

function setDateInputs(startDate, endDate, syncPicker = true) {
  els.startDate.value = toInputValue(startDate);
  els.endDate.value = toInputValue(endDate);
  els.rangeLabel.textContent = formatRangeLabel(startDate, endDate);
  if (syncPicker) {
    syncRangePickerFromInputs();
  }
}

function getDateRange() {
  const start = new Date(els.startDate.value);
  const end = new Date(els.endDate.value);
  return { start, end };
}

function syncRangePickerFromInputs() {
  if (!rangePickerInstance) return;
  const startValue = els.startDate.value;
  const endValue = els.endDate.value;
  if (!startValue || !endValue) return;
  rangePickerInstance.setDate([startValue, endValue], false);
}

function initRangePicker() {
  const flatpickrLib = window.flatpickr;
  if (!flatpickrLib || !els.rangePickerInput) return;

  if (rangePickerInstance) {
    rangePickerInstance.destroy();
  }

  rangePickerInstance = flatpickrLib(els.rangePickerInput, {
    dateFormat: "Y-m-d",
    defaultDate: [els.startDate.value, els.endDate.value],
    mode: "range",
    allowInput: false,
    disableMobile: true,
    position: "below",
    positionElement: els.endDate || els.startDate,
    onClose: handleRangeSelection,
  });

  [els.startDate, els.endDate].forEach((input) => {
    input?.addEventListener("click", () => {
      if (rangePickerInstance) {
        rangePickerInstance.open();
      }
    });
  });
}

function handleRangeSelection(selectedDates) {
  if (!Array.isArray(selectedDates) || selectedDates.length < 2) return;
  const [startDate, endDate] = selectedDates;
  if (!startDate || !endDate) return;
  setDateInputs(startDate, endDate, false);
  highlightQuick(null);
  loadActivities();
}

function getTotalPages() {
  return Math.max(1, Math.ceil(displayActivities.length / PAGE_SIZE));
}

function updatePaginationControls() {
  if (!els.pagination || !els.pageIndicator || !els.prevPage || !els.nextPage)
    return;
  const totalPages = getTotalPages();
  const shouldShow = displayActivities.length > PAGE_SIZE;
  els.pagination.hidden = !shouldShow;
  if (!shouldShow) return;
  if (currentPage > totalPages) currentPage = totalPages;
  els.pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  els.prevPage.disabled = currentPage === 1;
  els.nextPage.disabled = currentPage === totalPages;
}

function renderCurrentPage() {
  if (!els.list) return;
  if (!displayActivities.length) {
    renderList([], els.list);
    if (els.pagination) {
      els.pagination.hidden = true;
    }
    return;
  }

  const totalPages = getTotalPages();
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = displayActivities.slice(start, start + PAGE_SIZE);
  renderList(pageItems, els.list, expandedActivities);
  updatePaginationControls();
}

function highlightQuick(range) {
  els.quickButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === range);
  });
}

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

function persistCookieChoice(value) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Ignore storage errors (e.g., Safari private mode)
  }
}

function initCookieBanner() {
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

function updateAuthUI(authenticated) {
  isAuthenticated = authenticated;
  renderConnectButton(authenticated);
  setConnectAttention(!authenticated);
}

function handleAuthRequired(message) {
  updateAuthUI(false);
  showStatusMessage(
    message || "Connect Strava to load your activities.",
    "var(--muted)"
  );
}

async function ensureSessionCookie() {
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json().catch(() => ({}));
}

async function checkAuthStatus() {
  try {
    const res = await fetch("/api/token", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

function stopAuthPolling() {
  if (authPollTimer) {
    clearInterval(authPollTimer);
    authPollTimer = null;
  }
}

function startAuthPolling() {
  if (authPollTimer) return;
  authPollTimer = window.setInterval(async () => {
    const authed = await checkAuthStatus();
    if (authed) {
      stopAuthPolling();
      updateAuthUI(true);
      hideStatusSpinner();
      mapInstance = await initMap(els.map);
      loadActivities();
    }
  }, 2500);
}

function startAuthFlow(event) {
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
    startAuthPolling();
  } else {
    window.location.href = "/api/start";
  }
}

async function handleLogout(event) {
  event?.preventDefault();
  showStatusMessage("Logging out and clearing your data...", "var(--muted)");
  try {
    const res = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());    
    expandedActivities.clear();
    if (els.count) {
      els.count.textContent = "0";
    }
    renderCurrentPage();
    if (mapInstance) {
      renderPolylines(mapInstance, []);
    }
    updateAuthUI(false);
    showStatusMessage("Logged out and removed stored data.", "var(--muted)");
  } catch (err) {
    console.error("Logout failed:", err);
    showStatusMessage(err.message || "Failed to log out.", "var(--error)");
  }
  finally
  {
    displayActivities = [];
    allActivities = [];
  }

}

async function loadActivities() {
  const { start, end } = getDateRange();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showStatusMessage("Select a valid timeframe.", "var(--error)");
    return;
  }

  if (start > end) {
    showStatusMessage(
      "The start date has to be before the end date.",
      "var(--error)"
    );
    return;
  }

  els.rangeLabel.textContent = formatRangeLabel(start, end);
  showStatusSpinner();

  try {
    const params = new URLSearchParams({
      after: els.startDate.value,
      before: els.endDate.value,
    });
    
    allActivities = await api(`/api/activities?${params.toString()}`);
    addActivityTypeFilterButtons(allActivities);

    updateActivityDisplay();

    updateAuthUI(true);
  } catch (err) {
    console.error(err);
    if (AUTH_ERROR_PATTERN.test(err?.message || "")) {
      handleAuthRequired("Connect Strava to load your activities.");
    } else {
      showStatusMessage(err.message, "var(--error)");
    }
  } finally {
    hideStatusSpinner();
  }
}

function updateActivityDisplay() {
  showStatusSpinner();

  try
  {
    if (!allActivities.length) {
      displayActivities = [];
      els.count.textContent = "0";
      expandedActivities.clear();
      if (mapInstance) {
        renderPolylines(mapInstance, []);
      }
      currentPage = 1;
      renderCurrentPage();
      updatePaginationControls();
      return;
    }

    applyActivityFilter(currentActivityFilter);
  
    els.count.textContent = displayActivities.length.toString();
    expandedActivities.clear();
    
    if (mapInstance) {
      renderPolylines(mapInstance, displayActivities);
    }
  
    currentPage = 1;
    renderCurrentPage();
  }
  finally {
    hideStatusSpinner();
  }
}

function applyActivityFilter(filter) {
  const normalizedFilter = (filter || "All").toString().trim() || "All";
  currentActivityFilter = normalizedFilter;

  if (!allActivities.length) {
    displayActivities = [];
    return;
  }

  if (normalizedFilter === 'All') {
    displayActivities = [...allActivities];
    return;
  }

  displayActivities = allActivities.filter(
    a => a.type === normalizedFilter
  );
}

function setActiveActivityFilterButton(filterLabel = "All") {
  if (!els.activityFilterButtons) return;
  Array.from(els.activityFilterButtons.querySelectorAll("button")).forEach(
    (btn) => {
      const label = (btn.dataset.filter || btn.textContent || "").trim();
      btn.classList.toggle("active", label === filterLabel);
    }
  );
}

function addActivityTypeFilterButtons(activities){
  if (!els.activityFilterButtons) return;

  const activityTypes = [...new Set(activities.map(a => a.type).filter(Boolean))];
  const container = els.activityFilterButtons;

  // reset to the base "All" button
  Array.from(container.querySelectorAll("button")).forEach((btn, idx) => {
    if (idx === 0) {
      btn.dataset.filter = "All";
      btn.textContent = "All";
      btn.classList.add("active");
      return;
    }
    btn.remove();
  });

  activityTypes.forEach(type => {
    const label = String(type).trim();
    if (!label) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.filter = label;

    container.appendChild(button);
  });

  if (!activityFilterHandlerBound) {
    container.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button || !container.contains(button)) return;

      const filterValue = (button.dataset.filter || button.textContent || "").trim() || "All";
      currentActivityFilter = filterValue;
      setActiveActivityFilterButton(filterValue);
      updateActivityDisplay();
    });
    activityFilterHandlerBound = true;
  }

  const availableFilters = ["All", ...activityTypes];
  if (!availableFilters.includes(currentActivityFilter)) {
    currentActivityFilter = "All";
  }
  setActiveActivityFilterButton(currentActivityFilter);
}

function applyRange(range) {
  const end = new Date();
  const start = new Date(end);

  switch (range) {
    case "week":
      start.setDate(end.getDate() - 7);
      break;
    case "month":
      start.setMonth(end.getMonth() - 1);
      break;
    case "year":
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setFullYear(2009, 2, 1); // Strava launch date
      break;
  }

  setDateInputs(start, end);
  highlightQuick(range);
  loadActivities();
}

function setActiveMapStyle(styleId) {
  if (!els.mapStyleButtons?.length) return;
  els.mapStyleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mapStyle === styleId);
  });
}

function changeMapStyle(styleId) {
  if (!styleId || styleId === activeMapStyle) return;
  activeMapStyle = styleId;
  setActiveMapStyle(styleId);
  if (mapInstance) {
    applyMapStyle(mapInstance, styleId, displayActivities);
  }
}

async function init() {
  const hostname = window?.location?.hostname || "";
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  if (isLocal) {
    try {
      // Clear persisted state while working locally so changes are easy to test.
      window.localStorage.clear();
    } catch {
      window.localStorage.removeItem(COOKIE_CONSENT_KEY);
    }
  }

  const consentGiven = await initCookieBanner();

  if (!consentGiven) {
    return;
  }

  // add connect button once consent given
  document.querySelector('.btn-strava').classList.add('cookie-consent-given');  

  try {
    await ensureSessionCookie();
  } catch (err) {
    console.error("Failed to establish session:", err);
    showStatusMessage(
      "Unable to initialize your session. Reload the page and try again.",
      "var(--error)"
    );
    return;
  }

  try {
    mapInstance = await initMap(els.map);
  } catch (err) {
    console.error(err);
    showStatusMessage(err.message || "Failed to load the map.", "var(--error)");
  }

  applyRange("year");
  initRangePicker();

  els.quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyRange(btn.dataset.range));
  });

  els.mapStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => changeMapStyle(btn.dataset.mapStyle));
  });

  setActiveMapStyle(activeMapStyle);

  if (els.prevPage && els.nextPage) {
    els.prevPage.addEventListener("click", () => {
      if (currentPage === 1) return;
      currentPage -= 1;
      renderCurrentPage();
    });

    els.nextPage.addEventListener("click", () => {
      const totalPages = getTotalPages();
      if (currentPage >= totalPages) return;
      currentPage += 1;
      renderCurrentPage();
    });
  }

  if (els.list) {
    els.list.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-activity-toggle]");
      if (!toggle) return;
      const activityId = toggle.getAttribute("data-activity-toggle");
      if (!activityId) return;
      const key = String(activityId);
      if (expandedActivities.has(key)) {
        expandedActivities.delete(key);
      } else {
        expandedActivities.add(key);
      }
      renderCurrentPage();
    });
  }

  if (els.connect) {
    renderConnectButton(false);
    els.connect.addEventListener("click", (event) => {
      if (isAuthenticated) {
        handleLogout(event);
      } else {
        startAuthFlow(event);
      }
    });
  }

  checkAuthStatus().then((authed) => {
    updateAuthUI(authed);
  });
}
init().catch((err) => {
  console.error(err);
  showStatusMessage("Failed to initialize the app.", "var(--error)");
});
