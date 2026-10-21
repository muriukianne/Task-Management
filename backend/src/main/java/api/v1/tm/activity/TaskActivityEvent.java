package api.v1.tm.activity;

/**
 * CDI domain event fired when a task activity should be audited.
 * Persisted by {@link TaskActivityEventListener} in the same transaction.
 */
public record TaskActivityEvent(
        Long taskId,
        Long actorId,
        String actionType,
        String oldValue,
        String newValue
) {
    public static TaskActivityEvent statusChanged(Long taskId, Long actorId, String from, String to) {
        return new TaskActivityEvent(taskId, actorId, TaskActivityAction.STATUS_CHANGED, from, to);
    }

    public static TaskActivityEvent assigneeChanged(Long taskId, Long actorId, Long from, Long to) {
        return new TaskActivityEvent(
                taskId, actorId, TaskActivityAction.ASSIGNEE_CHANGED,
                from != null ? from.toString() : null,
                to != null ? to.toString() : null);
    }

    public static TaskActivityEvent fileUploaded(Long taskId, Long actorId, String previousFile, String newFile) {
        return new TaskActivityEvent(taskId, actorId, TaskActivityAction.FILE_UPLOADED, previousFile, newFile);
    }

    public static TaskActivityEvent commentAdded(Long taskId, Long actorId, String commentPreview) {
        return new TaskActivityEvent(taskId, actorId, TaskActivityAction.COMMENT_ADDED, null, commentPreview);
    }

    public static TaskActivityEvent taskCreated(Long taskId, Long actorId, String title) {
        return new TaskActivityEvent(taskId, actorId, TaskActivityAction.TASK_CREATED, null, title);
    }

    public static TaskActivityEvent taskRejected(Long taskId, Long actorId, String fromStatus, String reason) {
        return new TaskActivityEvent(taskId, actorId, TaskActivityAction.TASK_REJECTED, fromStatus, reason);
    }

    public static TaskActivityEvent userCreated(Long actorId, Long userId, String summary) {
        return new TaskActivityEvent(null, actorId, TaskActivityAction.USER_CREATED,
                null, formatUserChange(userId, summary));
    }

    public static TaskActivityEvent userUpdated(Long actorId, Long userId, String from, String to) {
        return new TaskActivityEvent(null, actorId, TaskActivityAction.USER_UPDATED,
                formatUserChange(userId, from), formatUserChange(userId, to));
    }

    public static TaskActivityEvent userDeleted(Long actorId, Long userId, String summary) {
        return new TaskActivityEvent(null, actorId, TaskActivityAction.USER_DELETED,
                formatUserChange(userId, summary), null);
    }

    private static String formatUserChange(Long userId, String detail) {
        if (detail == null || detail.isBlank()) {
            return "userId=" + userId;
        }
        return "userId=" + userId + " | " + detail;
    }
}
