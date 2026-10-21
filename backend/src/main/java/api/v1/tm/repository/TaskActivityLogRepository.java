package api.v1.tm.repository;

import api.v1.tm.entity.TaskActivityLog;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TaskActivityLogRepository implements PanacheRepositoryBase<TaskActivityLog, Long> {

    /** Chronological feed for a task (oldest → newest). */
    public List<TaskActivityLog> findByTaskIdAsc(Long taskId) {
        return find("taskId", Sort.by("createdAt").ascending(), taskId).list();
    }

    /** Newest-first feed (useful for sidebar “latest activity”). */
    public List<TaskActivityLog> findByTaskIdDesc(Long taskId) {
        return find("taskId", Sort.by("createdAt").descending(), taskId).list();
    }

    /**
     * Global audit feed with optional filters. Newest first.
     */
    public PanacheQuery<TaskActivityLog> findAllFiltered(Long actorId, String actionType, Long taskId) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder query = new StringBuilder();

        if (actorId != null) {
            append(query, "actorId = :actorId");
            params.put("actorId", actorId);
        }
        if (actionType != null && !actionType.isBlank()) {
            append(query, "actionType = :actionType");
            params.put("actionType", actionType.trim().toUpperCase());
        }
        if (taskId != null) {
            append(query, "taskId = :taskId");
            params.put("taskId", taskId);
        }

        if (query.isEmpty()) {
            return findAll(Sort.by("createdAt").descending());
        }
        return find(query.toString(), Sort.by("createdAt").descending(), params);
    }

    private static void append(StringBuilder query, String clause) {
        if (!query.isEmpty()) {
            query.append(" and ");
        }
        query.append(clause);
    }
}
