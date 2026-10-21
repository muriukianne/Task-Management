package api.v1.tm.repository;

import api.v1.tm.entity.Notification;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class NotificationRepository implements PanacheRepositoryBase<Notification, Long> {

    public PanacheQuery<Notification> findForRecipient(Long recipientId, boolean unreadOnly) {
        if (unreadOnly) {
            return find("recipientId = ?1 and readAt is null",
                    Sort.by("createdAt").descending(), recipientId);
        }
        return find("recipientId", Sort.by("createdAt").descending(), recipientId);
    }

    public long countUnread(Long recipientId) {
        return count("recipientId = ?1 and readAt is null", recipientId);
    }

    /**
     * True if this recipient already got the same due-alert type for this task today
     * (prevents daily scheduler spam).
     */
    public boolean existsToday(Long recipientId, Long taskId, String type) {
        if (recipientId == null || taskId == null || type == null) {
            return false;
        }
        return count(
                "recipientId = ?1 and taskId = ?2 and type = ?3 and createdAt >= ?4",
                recipientId, taskId, type, java.time.LocalDate.now().atStartOfDay()) > 0;
    }
}
