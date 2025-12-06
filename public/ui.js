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

export function renderList(activities, listEl) {
  if (!activities.length) {
    listEl.innerHTML = `<li class="muted">No activities matched this range.</li>`;
    return;
  }

  listEl.innerHTML = activities
    .map((a) => `
      <li>
        <div class="activity-info">
          <a class="activity-link" href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noreferrer">
            ${escapeHtml(a.name || "Untitled activity")}
          </a>
          <span class="activity-type">${escapeHtml(a.type || "-")}</span>
        </div>
        <span class="activity-date">${humanDate(a.date)}</span>
      </li>
    `)
    .join("");
}
