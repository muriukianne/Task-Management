package api.v1.tm.repository;

import api.v1.tm.entity.Task;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class TaskRepository implements PanacheRepositoryBase<Task, Long> {

    @Inject
    EntityManager em;

    /**
     * Ownership: task exists AND user is primary lead or a co-assignee.
     */
    public Optional<Task> findByIdAndAssignee(Long taskId, Long assigneeId) {
        List<Task> results = em.createQuery("""
                SELECT t FROM Task t
                WHERE t.taskId = :taskId
                  AND (
                    t.assignedTo = :userId
                    OR EXISTS (
                      SELECT 1 FROM TaskAssignee a
                      WHERE a.taskId = t.taskId AND a.userId = :userId
                    )
                  )
                """, Task.class)
                .setParameter("taskId", taskId)
                .setParameter("userId", assigneeId)
                .setMaxResults(1)
                .getResultList();
        return results.stream().findFirst();
    }

    /** Tasks referencing a user as lead, co-assignee, or assigner (blocks safe user delete). */
    public long countByUserInvolved(Long userId) {
        Long count = em.createQuery("""
                SELECT COUNT(DISTINCT t.taskId) FROM Task t
                WHERE t.assignedTo = :userId
                   OR t.assignedBy = :userId
                   OR EXISTS (
                     SELECT 1 FROM TaskAssignee a
                     WHERE a.taskId = t.taskId AND a.userId = :userId
                   )
                """, Long.class)
                .setParameter("userId", userId)
                .getSingleResult();
        return count != null ? count : 0L;
    }

    /**
     * Move task / related FK references from one user to another (orphan → invite merge).
     */
    public void reassignUserReferences(Long fromUserId, Long toUserId) {
        if (fromUserId == null || toUserId == null || fromUserId.equals(toUserId)) {
            return;
        }
        em.createQuery("UPDATE Task t SET t.assignedTo = :to WHERE t.assignedTo = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE Task t SET t.assignedBy = :to WHERE t.assignedBy = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        // Drop co-assignee rows that would collide, then move the rest
        em.createQuery("""
                DELETE FROM TaskAssignee a
                WHERE a.userId = :from
                  AND EXISTS (
                    SELECT 1 FROM TaskAssignee b
                    WHERE b.taskId = a.taskId AND b.userId = :to
                  )
                """)
                .setParameter("from", fromUserId)
                .setParameter("to", toUserId)
                .executeUpdate();
        em.createQuery("UPDATE TaskAssignee a SET a.userId = :to WHERE a.userId = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE TaskComment c SET c.authorId = :to WHERE c.authorId = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE TaskActivityLog a SET a.actorId = :to WHERE a.actorId = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE TaskDocument d SET d.uploadedBy = :to WHERE d.uploadedBy = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE Notification n SET n.recipientId = :to WHERE n.recipientId = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.createQuery("UPDATE Notification n SET n.actorId = :to WHERE n.actorId = :from")
                .setParameter("to", toUserId)
                .setParameter("from", fromUserId)
                .executeUpdate();
        em.flush();
    }

    /** Open (not done) tasks that have a due date — for due-alert scheduler. */
    public List<Task> findOpenWithDueDate() {
        return list("status <> ?1 and dueDate is not null", Sort.by("dueDate").ascending(), "done");
    }

    /**
     * Dynamic filter. When {@code assignedTo} is set, matches lead OR co-assignee membership.
     */
    public PanacheQuery<Task> findWithFilters(Long assignedTo, String status, String priority) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder query = new StringBuilder();

        if (assignedTo != null) {
            // Resolve co-assignee task ids up front — avoids Panache correlated-subquery quirks
            List<Long> memberTaskIds = em.createQuery(
                            "SELECT a.taskId FROM TaskAssignee a WHERE a.userId = :uid", Long.class)
                    .setParameter("uid", assignedTo)
                    .getResultList();
            if (memberTaskIds.isEmpty()) {
                append(query, "assignedTo = :assignedTo");
            } else {
                append(query, "(assignedTo = :assignedTo OR taskId IN :memberTaskIds)");
                params.put("memberTaskIds", memberTaskIds);
            }
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
