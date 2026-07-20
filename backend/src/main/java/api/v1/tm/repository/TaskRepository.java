package api.v1.tm.repository;

import api.v1.tm.entity.Task;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class TaskRepository implements PanacheRepositoryBase<Task, Long> {

    /**
     * Ownership boundary at the database layer: task exists AND is assigned to the given user.
     */
    public Optional<Task> findByIdAndAssignee(Long taskId, Long assigneeId) {
        return find("taskId = ?1 and assignedTo = ?2", taskId, assigneeId).firstResultOptional();
    }

    /** Tasks referencing a user as assignee or assigner (blocks safe user delete). */
    public long countByUserInvolved(Long userId) {
        return count("assignedTo = ?1 or assignedBy = ?1", userId);
    }

    /**
     * Dynamic filter query supporting optional status, priority, and assignedTo predicates.
     * Results are always sorted newest-first.
     */
    public PanacheQuery<Task> findWithFilters(Long assignedTo, String status, String priority) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder query = new StringBuilder();

        if (assignedTo != null) {
            append(query, "assignedTo = :assignedTo");
            params.put("assignedTo", assignedTo);
        }
        if (notBlank(status)) {
            append(query, "status = :status");
            params.put("status", status.trim().toLowerCase());
        }
        if (notBlank(priority)) {
            append(query, "priority = :priority");
            params.put("priority", priority.trim().toLowerCase());
        }

        Sort sort = Sort.by("createdAt").descending();
        return params.isEmpty()
                ? findAll(sort)
                : find(query.toString(), sort, params);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static void append(StringBuilder sb, String condition) {
        if (!sb.isEmpty()) sb.append(" and ");
        sb.append(condition);
    }
}
