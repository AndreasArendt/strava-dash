export function setStatus(text, color = "var(--muted)") {
  const el = document.getElementById("status");
  el.textContent = text;
  el.style.color = color;
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
