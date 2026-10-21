package api.v1.tm.dtos.responses;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Role-tailored dashboard payload.
 * <ul>
 *   <li>{@code scope = "personal"} — employee view (own assignee filter)</li>
 *   <li>{@code scope = "team"} — supervisor/admin view (all tasks)</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
public class DashboardMetricsResponse {

    /** {@code personal} or {@code team} */
    private String scope;

    /** Counts keyed by status: created, assigned, in_progress, resolved, done */
    private Map<String, Long> statusCounts;

    /** Tasks not in terminal {@code done} status */
    private long activeTotal;

    /** {@code due_date < today} and status not {@code done} */
    private long overdueCount;

    /** {@code due_date} within the next 3 days (inclusive), not done */
    private long dueSoonCount;

    /**
     * Mean hours from {@code created_at} → {@code updated_at} for tasks currently
     * in {@code done}. Null when there are no completed tasks in scope.
     */
    private Double avgTurnaroundHours;

    /** Median hours for completed tasks (same window as avg). */
    private Double medianTurnaroundHours;

    /** Completed ({@code done}) in the last 7 days */
    private long completedLast7Days;

    /**
     * Per-assignee open-task load. Populated only for {@code team} scope;
     * empty list for employees.
     */
    private List<WorkloadEntry> teamWorkload;

    /** Open tasks sitting in {@code resolved} awaiting supervisor sign-off (team scope). */
    private long bottleneckResolved;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @RegisterForReflection
    public static class WorkloadEntry {
        private Long userId;
        private String firstName;
        private String lastName;
        private String email;
        /** Open (not done) tasks assigned to this user */
        private long openTasks;
        private long inProgress;
        private long overdue;
    }
}
