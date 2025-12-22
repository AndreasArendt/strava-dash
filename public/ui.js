import { activityItemTemplate } from "./templates/activityItemTemplate.js";
import { activitySummaryTemplate } from "./templates/activitySummaryTemplate.js";

const spinnerEl = document.getElementById("status-spinner");
const messageEl = document.getElementById("status-message");
const summaryChartInstances = {};
const getCssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

function hideAllStatus() {
  if (spinnerEl) spinnerEl.hidden = true;
  if (messageEl) {
    messageEl.textContent = "";
    messageEl.hidden = true;
  }
}

export function showStatusSpinner() {
  if (spinnerEl) {
    spinnerEl.hidden = false;
  }
  if (messageEl) {
    messageEl.hidden = true;
  }
}

export function hideStatusSpinner() {
  if (spinnerEl) spinnerEl.hidden = true;
  if (messageEl) {
    messageEl.hidden = true;
    messageEl.textContent = "";
  }
}

export function showStatusMessage(text, color = "var(--error)") {
  hideAllStatus();
  if (messageEl) {
    messageEl.textContent = text;
    messageEl.style.color = color;
    messageEl.hidden = false;
  }
}

const escapeHtml = (str = "") =>
  str.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );

const humanDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatDistance = (meters = 0) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  const km = meters / 1000;
  const precision = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(precision)} km`;
};

const formatElevation = (meters = 0) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  return `${Math.round(meters)} m`;
};

const formatDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (hrs) parts.push(`${hrs}h`);
  parts.push(`${mins.toString().padStart(2, "0")}m`);
  return parts.join(" ");
};

const buildCumulativeSeries = (activities = [], { valueForActivity, convertValue = (v) => v }) => {
  const byDay = activities.reduce((acc, activity) => {
    const value = Number(valueForActivity(activity)) || 0;
    const date = activity?.date ? new Date(activity.date) : null;
    if (!value || !date || Number.isNaN(date.getTime())) return acc;
    const isoDay = date.toISOString().split("T")[0];
    acc.set(isoDay, (acc.get(isoDay) || 0) + value);
    return acc;
  }, new Map());

  const entries = Array.from(byDay.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  let running = 0;
  return entries.map(([isoDay, value]) => {
    running += value;
    const label = new Date(isoDay).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return { label, value: convertValue(running) };
  });
};

const renderCumulativeChart = (activities, containerEl, options) => {
  if (!containerEl) return;

  const canvas = containerEl.querySelector("canvas");
  if (!canvas) return;

  if (!window?.Chart) {
    containerEl.innerHTML = `<p class="muted">Timeline unavailable (Chart.js not loaded).</p>`;
    return;
  }

  const {
    key = options?.title || "chart",
    title = "",
    unitLabel = "",
    lineColor = "#2d3748",
    valueFormatter = (v) => `${v}`,
    valueForActivity,
    convertValue = (v) => v,
  } = options || {};

  const series = buildCumulativeSeries(activities, { valueForActivity, convertValue });
  if (!series.length) {
    containerEl.innerHTML = `<p class="muted">No data available for this range.</p>`;
    return;
  }

  const labels = series.map((point) => point.label);
  const data = series.map((point) => Number(point.value) || 0);

  if (summaryChartInstances[key]) {
    summaryChartInstances[key].destroy();
  }

  const accent = getCssVar("--accent", "#113c4c");
  const text = getCssVar("--text", "#0f172a");
  const border = getCssVar("--border", "rgba(15,23,42,0.12)");
  const muted = getCssVar("--muted", "#64748b");

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 240);
  gradient.addColorStop(0, `${lineColor || accent}22`);
  gradient.addColorStop(1, `${lineColor || accent}00`);

  summaryChartInstances[key] = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data,
          tension: 0.35,
          fill: false,
          borderColor: lineColor,
          backgroundColor: gradient,
          pointBackgroundColor: lineColor,
          pointBorderColor: lineColor,
          pointBorderWidth: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHoverBorderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: Boolean(title),
          text: title,
          color: text,
          font: { weight: 500, size: 14 },
          align: "start",
          padding: { bottom: 15 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => valueFormatter(ctx.parsed.y),
          },
          backgroundColor: "#fff",
          titleColor: text,
          bodyColor: text,
          borderColor: border,
          borderWidth: 1,
          displayColors: false,
        },
      },
      scales: {
        x: {
          title: { display: false, text: "", color: muted, font: { size: 11 } },
          grid: {
            color: border,
            borderColor: border,
          },
          ticks: {
            color: muted,
            maxRotation: 0,
            maxTicksLimit: 4,
          },
        },
        y: {
          title: { display: !!unitLabel, text: unitLabel, color: muted, font: { size: 11 } },
          grid: {
            color: border,
            borderColor: border,
          },
          ticks: {
            callback: (value) => valueFormatter(value),
            color: muted,
            maxTicksLimit: 6,
          },
        },
      },
    },
  });
};

export function renderSummary(totals, count, listEl, activities = []) {
  if (!listEl) return;
  const { distance = 0, movingTime = 0, elevationGain = 0 } = totals || {};
  const activityCount = Number(count) || 0;

  const activityCountLabel = `${activityCount} activit${activityCount === 1 ? "y" : "ies"}`;
  listEl.innerHTML = activitySummaryTemplate({
    activityCountLabel,
    totalDistance: formatDistance(distance),
    totalTime: formatDuration(movingTime),
    totalElevation: formatElevation(elevationGain),
  });

  const chartsContainer = listEl.querySelector(".summary-stats");
  const distanceEl = chartsContainer?.querySelector('[data-chart-type="distance"]');
  const elevationEl = chartsContainer?.querySelector('[data-chart-type="elevation"]');
  const timeEl = chartsContainer?.querySelector('[data-chart-type="time"]');

  const chartLineColor = getCssVar("--accent", "#1F3A5F");

  renderCumulativeChart(activities, distanceEl, {
    key: "distance",
    title: "",
    unitLabel: "",
    lineColor: chartLineColor,
    valueForActivity: (a) => a?.distance,
    convertValue: (v) => +(v / 1000).toFixed(2),
    valueFormatter: (v) => `${Number(v).toFixed(1)} km`,
  });

  renderCumulativeChart(activities, elevationEl, {
    key: "elevation",
    title: "",
    unitLabel: "",
    lineColor: chartLineColor,
    valueForActivity: (a) => a?.elevationGain,
    convertValue: (v) => Math.round(v),
    valueFormatter: (v) => `${Math.round(v)} m`,
  });

  renderCumulativeChart(activities, timeEl, {
    key: "time",
    title: "",
    unitLabel: "",
    lineColor: chartLineColor,
    valueForActivity: (a) => a?.movingTime,
    convertValue: (v) => +(v / 3600).toFixed(2),
    valueFormatter: (v) => `${Number(v).toFixed(1)} h`,
  });
}

export function renderList(activities, listEl) {
  if (!activities.length) {
    listEl.innerHTML = `<li class="muted">No activities matched this range.</li>`;
    return;
  }

  listEl.innerHTML = activities
    .map((a) =>
      activityItemTemplate({
        id: escapeHtml(a.id?.toString() || ""),
        name: escapeHtml(a.name || "Untitled activity"),
        type: escapeHtml(a.type || "-"),
        date: humanDate(a.date),
        distance: formatDistance(a.distance),
        movingTime: formatDuration(a.movingTime),
        elevationGain: formatElevation(a.elevationGain),
        hasMapdata: Boolean(a.hasMapdata),
      })
    )
    .join("");
}
