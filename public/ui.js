const spinnerEl = document.getElementById("status-spinner");
const messageEl = document.getElementById("status-message");

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

export function renderList(activities, listEl) {
  if (!activities.length) {
    listEl.innerHTML = `<li class="muted">No activities matched this range.</li>`;
    return;
  }

  listEl.innerHTML = activities
    .map((a) => `
      <li>
        <div class="activity-main">
          <div class="activity-info">
            <a class="activity-link" href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noreferrer">
              ${escapeHtml(a.name || "Untitled activity")}
            </a>
            <span class="activity-type">${escapeHtml(a.type || "-")}</span>
          </div>
          <span class="activity-date">${humanDate(a.date)}</span>
        </div>
        <div class="activity-stats">
          <div class="activity-stat">
            <span class="stat-label">Distance</span>
            <span class="stat-value">${formatDistance(a.distance)}</span>
          </div>
          <div class="activity-stat">
            <span class="stat-label">Moving time</span>
            <span class="stat-value">${formatDuration(a.movingTime)}</span>
          </div>
          <div class="activity-stat">
            <span class="stat-label">Elev. gain</span>
            <span class="stat-value">${formatElevation(a.elevationGain)}</span>
          </div>
        </div>
      </li>
    `)
    .join("");
}
