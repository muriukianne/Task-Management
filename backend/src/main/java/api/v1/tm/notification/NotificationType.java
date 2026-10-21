package api.v1.tm.notification;

/**
 * Canonical notification type values stored in {@code notifications.type}.
 */
public final class NotificationType {

    public static final String COMMENT_ADDED = "COMMENT_ADDED";
    public static final String TASK_REJECTED = "TASK_REJECTED";
    public static final String STATUS_CHANGED = "STATUS_CHANGED";
    public static final String ASSIGNEE_CHANGED = "ASSIGNEE_CHANGED";
    public static final String TASK_CREATED = "TASK_CREATED";
    public static final String FILE_UPLOADED = "FILE_UPLOADED";
    public static final String DUE_SOON = "DUE_SOON";
    public static final String DUE_TODAY = "DUE_TODAY";
    public static final String OVERDUE = "OVERDUE";
    public static final String LEAD_APPROVAL_PENDING = "LEAD_APPROVAL_PENDING";

    private NotificationType() {}
}
