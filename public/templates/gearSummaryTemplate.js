export function gearSummaryTemplate({ gearsLabel, items = [] }) {
  if (!Array.isArray(items) || !items.length) {
    return `<li class="muted">No gear data available for this selection.</li>`;
  }

  return `
    <li class="activity-card summary-card">
      <div class="activity-header">
        <div class="activity-title">
          <p class="activity-name">Gear distance</p>
          <p class="activity-meta">
            <span class="activity-type">${gearsLabel}</span>
          </p>
        </div>
      </div>
      <div class="summary-chart" aria-label="Gear distance chart">
        <canvas id="gear-chart"></canvas>
      </div>
    </li>
  `;
}
