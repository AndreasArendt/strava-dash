import { api } from "./api.js";
import { setStatus, renderList } from "./ui.js";
import { initMap, renderPolylines, applyMapStyle, DEFAULT_MAP_STYLE_ID } from "./map.js";

const els = {
  connect: document.getElementById("connect"),
  refresh: document.getElementById("refresh"),
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

async function loadActivities() {
  const { start, end } = getDateRange();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    setStatus("Select a valid timeframe.", "var(--error)");
    return;
  }

  if (start > end) {
    setStatus("The start date has to be before the end date.", "var(--error)");
    return;
  }

  els.rangeLabel.textContent = formatRangeLabel(start, end);
  setStatus("Loading activities…");

  try {
    const params = new URLSearchParams({ after: els.startDate.value, before: els.endDate.value });
    activities = await api(`/api/activities?${params.toString()}`);

    els.count.textContent = activities.length.toString();

    if (mapInstance) {
      renderPolylines(mapInstance, activities);
    }

    renderList(activities, els.list);

    setStatus("Activities loaded.", "var(--success)");
  } catch (err) {
    console.error(err);
    setStatus(err.message, "var(--error)");
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
    setStatus(err.message || "Failed to load the map.", "var(--error)");
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

  els.connect.onclick = () => {
    window.location.href = "/api/start";
  };

  els.refresh.onclick = loadActivities;
}
init().catch((err) => {
  console.error(err);
  setStatus("Failed to initialize the app.", "var(--error)");
});
