package api.v1.tm.activity;

/**
 * Canonical action_type values stored in {@code task_activity_logs.action_type}.
 * Kept as string constants (same style as task status / priority).
 */
public final class TaskActivityAction {

    public static final String STATUS_CHANGED = "STATUS_CHANGED";
    public static final String ASSIGNEE_CHANGED = "ASSIGNEE_CHANGED";
    public static final String COMMENT_ADDED = "COMMENT_ADDED";
    public static final String FILE_UPLOADED = "FILE_UPLOADED";
    public static final String TASK_CREATED = "TASK_CREATED";
    public static final String TASK_REJECTED = "TASK_REJECTED";

    /** Privileged team-management actions (task_id is null). */
    public static final String USER_CREATED = "USER_CREATED";
    public static final String USER_UPDATED = "USER_UPDATED";
    public static final String USER_DELETED = "USER_DELETED";

    private TaskActivityAction() {}
}
