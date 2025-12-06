import { api } from "./api.js";
import { renderList, showStatusSpinner, hideStatusSpinner, showStatusMessage } from "./ui.js";
import { initMap, renderPolylines, applyMapStyle, DEFAULT_MAP_STYLE_ID } from "./map.js";

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
  mapStyleButtons: document.querySelectorAll("[data-map-style]")
};

let activities = [];
let mapInstance;
let activeMapStyle = DEFAULT_MAP_STYLE_ID;
let authPollTimer = null;
const AUTH_ERROR_PATTERN = /(Not authenticated|Missing session state|No token)/i;

const toInputValue = (date) => {
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().split("T")[0];
};

const formatRangeLabel = (start, end) => {
  const opts = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} → ${end.toLocaleDateString(undefined, opts)}`;
};

function setDateInputs(startDate, endDate) {
  els.startDate.value = toInputValue(startDate);
  els.endDate.value = toInputValue(endDate);
  els.rangeLabel.textContent = formatRangeLabel(startDate, endDate);
}

function getDateRange() {
  const start = new Date(els.startDate.value);
  const end = new Date(els.endDate.value);
  return { start, end };
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

function handleAuthRequired(message) {
  setConnectAttention(true);
  showStatusMessage(message || "Connect Strava to load your activities.", "var(--muted)");
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
      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }
      authPopup = null;
      setConnectAttention(false);
      loadActivities();
    }
  }, 2500);
}

function startAuthFlow(event) {
  event?.preventDefault();
  const popup = window.open("/api/start", "strava-auth", "width=640,height=760");
  if (popup) {
    popup.focus();
    showStatusMessage("Complete the Strava authentication window, then return here.", "var(--muted)");
    startAuthPolling();
  } else {
    window.location.href = "/api/start";
  }
}

async function loadActivities() {
  const { start, end } = getDateRange();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showStatusMessage("Select a valid timeframe.", "var(--error)");
    return;
  }

  if (start > end) {
    showStatusMessage("The start date has to be before the end date.", "var(--error)");
    return;
  }

  els.rangeLabel.textContent = formatRangeLabel(start, end);
  showStatusSpinner();

  try {
    const params = new URLSearchParams({ after: els.startDate.value, before: els.endDate.value });
    activities = await api(`/api/activities?${params.toString()}`);

    els.count.textContent = activities.length.toString();

    if (mapInstance) {
      renderPolylines(mapInstance, activities);
    }

    renderList(activities, els.list);
    setConnectAttention(false);
    hideStatusSpinner();
  } catch (err) {
    console.error(err);
    if (AUTH_ERROR_PATTERN.test(err?.message || "")) {
      handleAuthRequired("Connect Strava to load your activities.");
    } else {
      showStatusMessage(err.message, "var(--error)");
    }
  }
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
    applyMapStyle(mapInstance, styleId, activities);
  }
}

async function init() {
  try {
    mapInstance = await initMap(els.map);
  } catch (err) {
    console.error(err);
    showStatusMessage(err.message || "Failed to load the map.", "var(--error)");
  }

  applyRange("year");

  els.quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyRange(btn.dataset.range));
  });

  els.mapStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => changeMapStyle(btn.dataset.mapStyle));
  });

  setActiveMapStyle(activeMapStyle);

  [els.startDate, els.endDate].forEach((input) => {
    input.addEventListener("change", () => {
      highlightQuick(null);
      loadActivities();
    });
  });

  els.connect.addEventListener("click", startAuthFlow);

  checkAuthStatus().then((authed) => {
    setConnectAttention(!authed);
  });
}
init().catch((err) => {
  console.error(err);
  showStatusMessage("Failed to initialize the app.", "var(--error)");
});
