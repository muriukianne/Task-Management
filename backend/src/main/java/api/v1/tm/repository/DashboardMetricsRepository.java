package api.v1.tm.repository;

import api.v1.tm.dtos.responses.DashboardMetricsResponse.WorkloadEntry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregated dashboard analytics via native PostgreSQL queries.
 * Pass {@code assigneeId = null} for team-wide (supervisor/admin) scope;
 * pass the caller's {@code app_users.id} for personal (employee) scope.
 */
@ApplicationScoped
public class DashboardMetricsRepository {

    private static final List<String> ALL_STATUSES = List.of(
            "created", "assigned", "in_progress", "pending_approval", "resolved", "done");

    @Inject
    EntityManager em;

    private static final String ASSIGNEE_SCOPE = """
            (:assigneeId IS NULL
             OR t.assigned_to = :assigneeId
             OR EXISTS (
               SELECT 1 FROM task_assignees ta
               WHERE ta.task_id = t.task_id AND ta.user_id = :assigneeId
             ))
            """;
    @SuppressWarnings("unchecked")
    public Map<String, Long> countByStatus(Long assigneeId) {
        String sql = """
                SELECT t.status, COUNT(*) AS cnt
                FROM tasks t
                WHERE %s
                GROUP BY t.status
                """.formatted(ASSIGNEE_SCOPE);
        Query q = em.createNativeQuery(sql);
        q.setParameter("assigneeId", assigneeId);

        Map<String, Long> counts = new LinkedHashMap<>();
        for (String s : ALL_STATUSES) {
            counts.put(s, 0L);
        }
        for (Object row : q.getResultList()) {
            Object[] cols = (Object[]) row;
            String status = cols[0] != null ? cols[0].toString() : "unknown";
            long cnt = ((Number) cols[1]).longValue();
            counts.put(status, cnt);
        }
        return counts;
    }

    public long countOverdue(Long assigneeId) {
        String sql = """
                SELECT COUNT(*)
                FROM tasks t
                WHERE t.status <> 'done'
                  AND t.due_date IS NOT NULL
                  AND t.due_date < CURRENT_DATE
                  AND %s
                """.formatted(ASSIGNEE_SCOPE);
        return singleLong(sql, assigneeId);
    }

    public long countDueSoon(Long assigneeId, int withinDays) {
        String sql = """
                SELECT COUNT(*)
                FROM tasks t
                WHERE t.status <> 'done'
                  AND t.due_date IS NOT NULL
                  AND t.due_date >= CURRENT_DATE
                  AND t.due_date <= (CURRENT_DATE + :withinDays)
                  AND %s
                """.formatted(ASSIGNEE_SCOPE);
        Query q = em.createNativeQuery(sql);
        q.setParameter("assigneeId", assigneeId);
        q.setParameter("withinDays", withinDays);
        return ((Number) q.getSingleResult()).longValue();
    }

    public long countCompletedLastDays(Long assigneeId, int days) {
        String sql = """
                SELECT COUNT(*)
                FROM tasks t
                WHERE t.status = 'done'
                  AND t.updated_at >= (CURRENT_TIMESTAMP - (:days * INTERVAL '1 day'))
                  AND %s
                """.formatted(ASSIGNEE_SCOPE);
        Query q = em.createNativeQuery(sql);
        q.setParameter("assigneeId", assigneeId);
        q.setParameter("days", days);
        return ((Number) q.getSingleResult()).longValue();
    }

    /**
     * Avg / median turnaround hours for {@code done} tasks
     * (created_at → updated_at as completion proxy).
     *
     * @return {@code [avgHours, medianHours]} — either may be null if no rows
     */
    @SuppressWarnings("unchecked")
    public Double[] turnaroundHours(Long assigneeId) {
        String sql = """
                SELECT
                  AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0) AS avg_hours,
                  PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
                  ) AS median_hours
                FROM tasks t
                WHERE t.status = 'done'
                  AND t.created_at IS NOT NULL
                  AND t.updated_at IS NOT NULL
                  AND t.updated_at >= t.created_at
                  AND %s
                """.formatted(ASSIGNEE_SCOPE);
        Query q = em.createNativeQuery(sql);
        q.setParameter("assigneeId", assigneeId);
        Object[] row = (Object[]) q.getSingleResult();
        return new Double[]{ toDouble(row[0]), toDouble(row[1]) };
    }

    public long countResolvedBottleneck(Long assigneeId) {
        String sql = """
                SELECT COUNT(*)
                FROM tasks t
                WHERE t.status = 'resolved'
                  AND %s
                """.formatted(ASSIGNEE_SCOPE);
        return singleLong(sql, assigneeId);
    }

    /**
     * Open-task load per employee assignee. Intended for team (privileged) scope only.
     * Counts a task for each user who is lead or co-assignee.
     */
    @SuppressWarnings("unchecked")
    public List<WorkloadEntry> teamWorkload() {
        String sql = """
                SELECT
                  u.id,
                  u.first_name,
                  u.last_name,
                  u.email,
                  COUNT(DISTINCT t.task_id) FILTER (WHERE t.status <> 'done') AS open_tasks,
                  COUNT(DISTINCT t.task_id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
                  COUNT(DISTINCT t.task_id) FILTER (
                    WHERE t.status <> 'done'
                      AND t.due_date IS NOT NULL
                      AND t.due_date < CURRENT_DATE
                  ) AS overdue
                FROM app_users u
                LEFT JOIN task_assignees ta ON ta.user_id = u.id
                LEFT JOIN tasks t ON t.task_id = ta.task_id
                WHERE LOWER(u.role) = 'employee'
                GROUP BY u.id, u.first_name, u.last_name, u.email
                HAVING COUNT(DISTINCT t.task_id) FILTER (WHERE t.status <> 'done') > 0
                    OR COUNT(DISTINCT t.task_id) > 0
                ORDER BY open_tasks DESC, u.last_name ASC, u.first_name ASC
                """;
        List<WorkloadEntry> result = new ArrayList<>();
        for (Object row : em.createNativeQuery(sql).getResultList()) {
            Object[] cols = (Object[]) row;
            result.add(WorkloadEntry.builder()
                    .userId(((Number) cols[0]).longValue())
                    .firstName(cols[1] != null ? cols[1].toString() : "")
                    .lastName(cols[2] != null ? cols[2].toString() : "")
                    .email(cols[3] != null ? cols[3].toString() : "")
                    .openTasks(cols[4] != null ? ((Number) cols[4]).longValue() : 0L)
                    .inProgress(cols[5] != null ? ((Number) cols[5]).longValue() : 0L)
                    .overdue(cols[6] != null ? ((Number) cols[6]).longValue() : 0L)
                    .build());
        }
        return result;
    }

    private long singleLong(String sql, Long assigneeId) {
        Query q = em.createNativeQuery(sql);
        q.setParameter("assigneeId", assigneeId);
        return ((Number) q.getSingleResult()).longValue();
    }

    private static Double toDouble(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd.doubleValue();
        if (value instanceof Number n) return n.doubleValue();
        return Double.parseDouble(value.toString());
    }
}
