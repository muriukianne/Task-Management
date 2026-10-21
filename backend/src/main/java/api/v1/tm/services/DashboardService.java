package api.v1.tm.services;

import api.v1.tm.dtos.responses.DashboardMetricsResponse;

public interface DashboardService {

    /** Synchronous role-scoped dashboard metrics for the authenticated caller. */
    DashboardMetricsResponse getMetrics();
}
