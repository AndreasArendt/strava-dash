export const state = {
  allActivities: [],
  displayActivities: [],
  currentActivityFilter: "All",
  activeSummaryStyle: "all",
  mapInstance: null,
  activeMapStyle: "bright",
  authPollTimer: null,
  currentPage: 1,
  expandedActivities: new Set(),
  rangePickerInstance: null,
  isAuthenticated: false,
  activityFilterHandlerBound: false,
};
