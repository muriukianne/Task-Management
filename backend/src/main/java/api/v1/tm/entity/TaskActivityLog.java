package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "task_activity_logs",
    indexes = {
        @Index(name = "idx_activity_task_id", columnList = "task_id"),
        @Index(name = "idx_activity_task_created", columnList = "task_id, created_at"),
        @Index(name = "idx_activity_actor_id", columnList = "actor_id"),
        @Index(name = "idx_activity_action_type", columnList = "action_type")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** Null for non-task system/user management actions. */
    @Column(name = "task_id")
    private Long taskId;

    /** Immutable {@link AppUser#id} of the user who performed the action. */
    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    /**
     * One of {@link api.v1.tm.activity.TaskActivityAction} constants,
     * e.g. STATUS_CHANGED, COMMENT_ADDED, FILE_UPLOADED.
     */
    @Column(name = "action_type", nullable = false, length = 50)
    private String actionType;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
