export function activityItemTemplate({
  id,
  name,
  type,
  date,
  distance,
  movingTime,
  elevationGain,
  hasMapdata,
}) {
  const mapButton = hasMapdata
    ? `
            <button
              type="button"
              class="activity-map-link"
              data-activity-focus="${id}"
              aria-label="Zoom to ${name}"
            >
              <i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i>
              <span>View on Map</span>
            </button>
    `
    : "";

  return `
      <li class="activity-card">
        <div class="activity-header">
          <div class="activity-title">
            <p class="activity-name">${name}</p>
            <p class="activity-meta">
              <span class="activity-type">${type}</span>
              <span aria-hidden="true">•</span>
              <span class="activity-date">${date}</span>
            </p>
          </div>
          <div class="activity-actions">
            ${mapButton}
            <a
              class="activity-strava-link"
              href="https://www.strava.com/activities/${id}"
              target="_blank"
              rel="noreferrer"
            >
              <i class="fa-brands fa-strava" aria-hidden="true"></i>            
              <span>View on Strava</span>
            </a>          
          </div>
        </div>
        <div class="activity-stats">
          <div class="activity-stat">
            <span class="stat-label">Distance</span>
            <span class="stat-value">${distance}</span>
          </div>
          <div class="activity-stat">
            <span class="stat-label">Moving time</span>
            <span class="stat-value">${movingTime}</span>
          </div>
          <div class="activity-stat">
            <span class="stat-label">Elev. gain</span>
            <span class="stat-value">${elevationGain}</span>
          </div>
        </div>
      </li>
  `;
}
