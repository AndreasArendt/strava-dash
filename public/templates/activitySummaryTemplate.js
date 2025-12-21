export function activitySummaryTemplate({
  activityCountLabel,
  totalDistance,
  totalTime,
  totalElevation,
}) {
  return `
    <li class="activity-card summary-card">
      <div class="activity-header">
        <div class="activity-title">  
        <p class="activity-name">Summary</p>        
          <p class="activity-meta">
            <span class="activity-type">${activityCountLabel}</span>
          </p>
        </div>
      </div>
      <div class="activity-stats summary-stats">
        <div class="activity-stat">
          <span class="stat-label">Total distance</span>
          <span class="stat-value">${totalDistance}</span>
          <div class="summary-chart" data-chart-type="distance">
            <canvas aria-label="Cumulative distance chart"></canvas>
          </div>
        </div>
        <div class="activity-stat">
          <span class="stat-label">Total time</span>
          <span class="stat-value">${totalTime}</span>
          <div class="summary-chart" data-chart-type="time">
            <canvas aria-label="Cumulative time chart"></canvas>
          </div>
        </div>
        <div class="activity-stat">
          <span class="stat-label">Total elev. gain</span>
          <span class="stat-value">${totalElevation}</span>
          <div class="summary-chart" data-chart-type="elevation">
            <canvas aria-label="Cumulative elevation gain chart"></canvas>
          </div>
        </div>
      </div>
    </li>
  `;
}
