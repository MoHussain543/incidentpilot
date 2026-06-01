export const INCIDENT_LIMITS = {
  title: 120,
  serviceName: 120,
  environment: 60,
  alertMessage: 800,
  logsOrStackTrace: 20_000,
  recentDeployNotes: 5_000
} as const;
