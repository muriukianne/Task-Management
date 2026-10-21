package api.v1.tm.services;

import api.v1.tm.dtos.responses.DashboardMetricsResponse;
import api.v1.tm.repository.DashboardMetricsRepository;
import api.v1.tm.utils.JwtHelper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Collections;
import java.util.Map;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private static final int DUE_SOON_DAYS = 3;
    private static final int COMPLETED_WINDOW_DAYS = 7;

    private final DashboardMetricsRepository metricsRepository;
    private final JwtHelper jwt;

    @Override
    @Transactional
    public DashboardMetricsResponse getMetrics() {
        boolean teamScope = jwt.isPrivileged();
        Long assigneeFilter = teamScope ? null : jwt.getAppUserId();
        String scope = teamScope ? "team" : "personal";

        Map<String, Long> statusCounts = metricsRepository.countByStatus(assigneeFilter);
        long activeTotal = statusCounts.entrySet().stream()
                .filter(e -> !"done".equals(e.getKey()))
                .mapToLong(Map.Entry::getValue)
                .sum();

        Double[] turnaround = metricsRepository.turnaroundHours(assigneeFilter);

        DashboardMetricsResponse.DashboardMetricsResponseBuilder builder = DashboardMetricsResponse.builder()
                .scope(scope)
                .statusCounts(statusCounts)
                .activeTotal(activeTotal)
                .overdueCount(metricsRepository.countOverdue(assigneeFilter))
                .dueSoonCount(metricsRepository.countDueSoon(assigneeFilter, DUE_SOON_DAYS))
                .avgTurnaroundHours(round1(turnaround[0]))
                .medianTurnaroundHours(round1(turnaround[1]))
                .completedLast7Days(metricsRepository.countCompletedLastDays(
                        assigneeFilter, COMPLETED_WINDOW_DAYS))
                .bottleneckResolved(metricsRepository.countResolvedBottleneck(assigneeFilter));

        if (teamScope) {
            builder.teamWorkload(metricsRepository.teamWorkload());
        } else {
            builder.teamWorkload(Collections.emptyList());
        }

        DashboardMetricsResponse metrics = builder.build();
        log.info("Dashboard metrics scope={} active={} overdue={} role={}",
                scope, activeTotal, metrics.getOverdueCount(), jwt.getRole());
        return metrics;
    }

    private static Double round1(Double value) {
        if (value == null) return null;
        return Math.round(value * 10.0) / 10.0;
    }
}
