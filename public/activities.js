import { api } from "./api.js";
import {
  renderList,
  renderSummary,
  showStatusSpinner,
  hideStatusSpinner,
  showStatusMessage,
} from "./ui.js";
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
  const shouldShow = state.displayActivities.length > PAGE_SIZE;
  els.pagination.hidden = !shouldShow;
  if (!shouldShow) return;
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  els.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
  els.prevPage.disabled = state.currentPage === 1;
  els.nextPage.disabled = state.currentPage === totalPages;
}

export function renderCurrentPage() {
  if (!els.list) return;
  if (!state.displayActivities.length) {
    renderList([], els.list);
    if (els.pagination) {
      els.pagination.hidden = true;
    }
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

  if (!state.allActivities.length) {
    state.displayActivities = [];
    return;
  }

  if (normalizedFilter === "All") {
    state.displayActivities = [...state.allActivities];
    return;
  }

  state.displayActivities = state.allActivities.filter(
    (activity) => activity.type === normalizedFilter
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

export function setActiveActivitySummaryButton(filterLabel = "all") {
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
      updateActivityDisplay();
    });
    state.activityFilterHandlerBound = true;
  }

  const availableFilters = ["All", ...activityTypes];
  if (!availableFilters.includes(state.currentActivityFilter)) {
    state.currentActivityFilter = "All";
  }
  setActiveActivityFilterButton(state.currentActivityFilter);
}

export function updateActivityDisplay({ skipMapUpdate = false } = {}) {
  showStatusSpinner();

  try {
    const isSummary = state.activeSummaryStyle === "summary";
    if (els.pagination) {
      els.pagination.hidden = isSummary;
      els.pagination.classList.toggle("display-summary", isSummary);
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

    els.count.textContent = state.displayActivities.length.toString();
    state.expandedActivities.clear();

    if (!skipMapUpdate && state.mapInstance) {
      renderPolylines(state.mapInstance, state.displayActivities);
    }

    if (isSummary) {
      const totals = state.displayActivities.reduce(
        (acc, item) => {
          acc.distance += Number(item.distance) || 0;
          acc.movingTime += Number(item.movingTime) || 0;
          acc.elevationGain += Number(item.elevationGain) || 0;
          return acc;
        },
        { distance: 0, movingTime: 0, elevationGain: 0 }
      );
      renderSummary(totals, state.displayActivities.length, els.list);
      return;
    }

    state.currentPage = 1;
    renderCurrentPage();
  } finally {
    hideStatusSpinner();
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
  updateActivityDisplay({ skipMapUpdate: true });
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
    const params = new URLSearchParams({
      after: els.startDate.value,
      before: els.endDate.value,
    });

    state.allActivities = await api(`/api/activities?${params.toString()}`);
    addActivityTypeFilterButtons(state.allActivities);

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

export function bindMapStyleButtons() {
  els.mapStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => changeMapStyle(btn.dataset.mapStyle));
  });
}

export function bindSummaryStyleButtons() {
  els.summaryStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () =>
      changeSummaryStyle(btn.getAttribute("activity-summary-style"))
    );
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
