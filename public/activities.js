import { api } from "./api.js";
import {
  renderList,
  renderSummary,
  showStatusSpinner,
  hideStatusSpinner,
  showStatusMessage,
} from "./ui.js";
import { gearSummaryTemplate } from "./templates/gearSummaryTemplate.js";
import { renderPolylines, applyMapStyle, focusActivity } from "./map.js";
import { els } from "./dom.js";
import { state } from "./state.js";
import { getDateRange, formatRangeLabel } from "./dateRange.js";
import { handleAuthRequired, updateAuthUI } from "./auth.js";

const PAGE_SIZE = 10;
const AUTH_ERROR_PATTERN = /(Not authenticated|Missing session state|No token)/i;

function getTotalPages() {
  return Math.max(1, Math.ceil(state.displayActivities.length / PAGE_SIZE));
}

function updatePaginationControls() {
  if (!els.pagination || !els.pageIndicator || !els.prevPage || !els.nextPage)
    return;
  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  els.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
  els.prevPage.disabled = state.currentPage === 1;
  els.nextPage.disabled = state.currentPage === totalPages;
  const shouldShow = state.displayActivities.length > PAGE_SIZE;
  els.pagination.hidden = !shouldShow;
}

export function renderCurrentPage() {
  if (!els.list) return;
  if (!state.displayActivities.length) {
    state.currentPage = 1;
    renderList([], els.list);
    if (els.pagination) {
      els.pagination.hidden = true;
    }
    updatePaginationControls();
    return;
  }

  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageItems = state.displayActivities.slice(start, start + PAGE_SIZE);
  renderList(pageItems, els.list, state.expandedActivities);
  updatePaginationControls();
}

function applyActivityFilter(filter) {
  const normalizedFilter = (filter || "All").toString().trim() || "All";
  state.currentActivityFilter = normalizedFilter;

  const collectGearIds = (activities = []) =>
    [...new Set(activities.map((item) => item.gear_id).filter(Boolean))];

  if (!state.allActivities.length) {
    state.displayActivities = [];
    state.displayGearIDs = [];
    return;
  }

  if (normalizedFilter === "All") {
    state.displayActivities = [...state.allActivities];
    state.displayGearIDs = collectGearIds(state.displayActivities);
    return;
  }

  state.displayActivities = state.allActivities.filter(
    (activity) => activity.type === normalizedFilter
  );
  state.displayGearIDs = collectGearIds(state.displayActivities);

  console.log(state.displayGearIDs);
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

export function setActiveActivitySummaryButton(filterLabel = "summary") {
  if (!els.activitySummaryButtons) return;
  const normalized = (filterLabel || "").toString().toLowerCase();
  Array.from(els.activitySummaryButtons.querySelectorAll("button")).forEach(
    (btn) => {
      const label =
        btn.getAttribute("activity-summary-style") ||
        btn.dataset.filter ||
        btn.textContent ||
        "";
      btn.classList.toggle(
        "active",
        label.toString().toLowerCase() === normalized
      );
    }
  );
}

function addActivityTypeFilterButtons(activities) {
  if (!els.activityFilterButtons) return;

  const activityTypes = [...new Set(activities.map((a) => a.type).filter(Boolean))];
  const container = els.activityFilterButtons;

  Array.from(container.querySelectorAll("button")).forEach((btn, idx) => {
    if (idx === 0) {
      btn.dataset.filter = "All";
      btn.textContent = "All";
      btn.classList.add("active");
      return;
    }
    btn.remove();
  });

  activityTypes.forEach((type) => {
    const label = String(type).trim();
    if (!label) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.filter = label;

    container.appendChild(button);
  });

  if (!state.activityFilterHandlerBound) {
    container.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button || !container.contains(button)) return;

      const filterValue =
        (button.dataset.filter || button.textContent || "").trim() || "All";
      state.currentActivityFilter = filterValue;
      setActiveActivityFilterButton(filterValue);
      updateActivityDisplay().catch((err) =>
        console.error("Failed to update activities:", err)
      );
    });
    state.activityFilterHandlerBound = true;
  }

  const availableFilters = ["All", ...activityTypes];
  if (!availableFilters.includes(state.currentActivityFilter)) {
    state.currentActivityFilter = "All";
  }
  setActiveActivityFilterButton(state.currentActivityFilter);
}

function computeTotals(activities) {
  return activities.reduce(
    (acc, item) => {
      acc.distance += Number(item.distance) || 0;
      acc.movingTime += Number(item.movingTime) || 0;
      acc.elevationGain += Number(item.elevationGain) || 0;
      return acc;
    },
    { distance: 0, movingTime: 0, elevationGain: 0 }
  );
}

const getCssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

const formatGearLabel = (gear) => {
  const parts = [gear?.brand_name, gear?.model_name]
    .map((p) => (p || "").toString().trim())
    .filter(Boolean);
  return parts.join(" - ") || gear?.id || "Gear";
};

function renderGearChart(items = []) {
  if (!els.list) return;
  const canvas = els.list.querySelector("#gear-chart");
  if (!canvas || !items.length) return;

  if (state.gearChartInstance) {
    state.gearChartInstance.destroy();
    state.gearChartInstance = null;
  }

  if (!window?.Chart) {
    canvas.parentElement.innerHTML = `<p class="muted">Chart unavailable (Chart.js not loaded).</p>`;
    return;
  }

  const labels = items.map((item) => formatGearLabel(item));
  const distances = items.map((item) =>
    Number.isFinite(item?.distance) ? +(item.distance / 1000).toFixed(2) : 0
  );

  const barColor = getCssVar("--accent", "#113c4c");
  const border = getCssVar("--border", "rgba(15,23,42,0.12)");
  const muted = getCssVar("--muted", "#64748b");

  state.gearChartInstance = new window.Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: distances,
          backgroundColor: `${barColor}cc`,
          borderColor: barColor,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 18,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x?.toFixed(1) || 0} km`,
          },
        },
      },
      scales: {
        x: {
          title: { display: false },
          grid: { color: border },
          ticks: {
            color: muted,
            callback: (val) => `${val} km`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: muted },
        },
      },
    },
  });
}

async function fetchGearDetails(gearIds = []) {
  const ids = (gearIds || []).filter(Boolean);
  if (!ids.length) return [];

  const missing = ids.filter((id) => !state.gearCache.has(id));
  if (missing.length) {
    const params = new URLSearchParams();
    missing.forEach((id) => params.append("id", id));
    const fetched = await api(`/api/gears?${params.toString()}`);
    if (Array.isArray(fetched)) {
      fetched.forEach((item) => state.gearCache.set(item.id, item));      
    }
  }

  return ids
    .map((id) => state.gearCache.get(id))
    .filter(Boolean);
}

const viewModes = {
  list: {
    showPagination: true,
    useGlobalSpinner: true,
    prepare: () => ({}),
    render: () => renderCurrentPage(),
  },
  summary: {
    showPagination: false,
    useGlobalSpinner: true,
    prepare: (activities) => ({ totals: computeTotals(activities) }),
    render: ({ context, activities }) =>
      renderSummary(context.totals, activities.length, els.list, activities),
  },
  gears: {
    showPagination: false,
    useGlobalSpinner: false,
    renderLoading: () => {
      if (!els.list) return;
      els.list.innerHTML = gearSummaryTemplate({
        gearsLabel: "Loading gear…",
        items: [],
        loading: true,
      });
    },
    prepare: async () => {
      const gear = await fetchGearDetails(state.displayGearIDs);
      return { gear };
    },
    render: ({ context }) => {
      if (!els.list) return;
      const gearsCount = Array.isArray(context.gear) ? context.gear.length : 0;
      const gearsLabel = `${gearsCount} gear${gearsCount === 1 ? "" : "s"}`;
      els.list.innerHTML = gearSummaryTemplate({ gearsLabel, items: context.gear });
      renderGearChart(context.gear);
    },
  },
};

export async function updateActivityDisplay({ skipMapUpdate = false } = {}) {
  let viewMode = viewModes[state.activeSummaryStyle] || viewModes.list;
  if (viewMode.useGlobalSpinner !== false) {
    showStatusSpinner();
  }

  try {
    if (els.pagination) {
      els.pagination.hidden = !viewMode.showPagination;
      els.pagination.classList.toggle("display-summary", !viewMode.showPagination);
    }

    if (!state.allActivities.length) {
      state.displayActivities = [];
      els.count.textContent = "0";
      state.expandedActivities.clear();
      if (!skipMapUpdate && state.mapInstance) {
        renderPolylines(state.mapInstance, []);
      }
      renderList([], els.list);
      state.currentPage = 1;
      renderCurrentPage();
      updatePaginationControls();
      return;
    }

    applyActivityFilter(state.currentActivityFilter);
    state.currentPage = 1;

    els.count.textContent = state.displayActivities.length.toString();
    state.expandedActivities.clear();

    if (!skipMapUpdate && state.mapInstance) {
      renderPolylines(state.mapInstance, state.displayActivities);
    }

    if (viewMode.renderLoading) {
      viewMode.renderLoading();
    }

    const context = viewMode.prepare
      ? await viewMode.prepare(state.displayActivities)
      : {};
    await Promise.resolve(
      viewMode.render({ context, activities: state.displayActivities })
    );
  } finally {
    if (viewMode.useGlobalSpinner !== false) {
      hideStatusSpinner();
    }
  }
}

export function setActiveMapStyle(styleId) {
  if (!els.mapStyleButtons?.length) return;
  els.mapStyleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mapStyle === styleId);
  });
}

export function changeMapStyle(styleId) {
  if (!styleId || styleId === state.activeMapStyle) return;
  state.activeMapStyle = styleId;
  setActiveMapStyle(styleId);
  if (state.mapInstance) {
    applyMapStyle(state.mapInstance, styleId, state.displayActivities);
  }
}

export function changeSummaryStyle(styleId) {
  const next = (styleId || "").toString().toLowerCase();
  if (!next || next === state.activeSummaryStyle) return;

  state.activeSummaryStyle = next;
  setActiveActivitySummaryButton(next);
  return updateActivityDisplay({ skipMapUpdate: true });
}

export async function loadActivities() {
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
    const before = new Date(els.endDate.value);
    before.setDate(before.getDate() + 1); // include end date activities by offsetting the upper bound
    const beforeParam = Number.isNaN(before.getTime())
      ? els.endDate.value
      : before.toISOString();

    const params = new URLSearchParams({
      after: els.startDate.value,
      before: beforeParam,
    });

    state.allActivities = await api(`/api/activities?${params.toString()}`);
    addActivityTypeFilterButtons(state.allActivities);

    await updateActivityDisplay();

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

export function bindMapStyleButtons() {
  els.mapStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => changeMapStyle(btn.dataset.mapStyle));
  });
}

export function bindSummaryStyleButtons() {
  els.summaryStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      changeSummaryStyle(btn.getAttribute("activity-summary-style"))?.catch(
        (err) => console.error("Failed to switch summary view:", err)
      );
    });
  });
}

export function bindPaginationControls() {
  if (!els.prevPage || !els.nextPage) return;
  els.prevPage.addEventListener("click", () => {
    if (state.currentPage === 1) return;
    state.currentPage -= 1;
    renderCurrentPage();
  });

  els.nextPage.addEventListener("click", () => {
    const totalPages = getTotalPages();
    if (state.currentPage >= totalPages) return;
    state.currentPage += 1;
    renderCurrentPage();
  });
}

export function bindListToggle() {
  if (!els.list) return;
  els.list.addEventListener("click", (event) => {
    const focusButton = event.target.closest("[data-activity-focus]");
    if (focusButton) {
      const activityId = focusButton.getAttribute("data-activity-focus");
      const activity = state.displayActivities.find(
        (a) => String(a.id) === String(activityId)
      );
      if (activity && state.mapInstance) {
        focusActivity(state.mapInstance, activity);
      }
      return;
    }

    const toggle = event.target.closest("[data-activity-toggle]");
    if (!toggle) return;
    const activityId = toggle.getAttribute("data-activity-toggle");
    if (!activityId) return;
    const key = String(activityId);
    if (state.expandedActivities.has(key)) {
      state.expandedActivities.delete(key);
    } else {
      state.expandedActivities.add(key);
    }
    renderCurrentPage();
  });
}
