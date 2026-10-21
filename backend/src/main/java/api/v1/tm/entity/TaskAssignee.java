package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "task_assignees",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_task_assignee",
        columnNames = {"task_id", "user_id"}
    ),
    indexes = {
        @Index(name = "idx_task_assignees_task_id", columnList = "task_id"),
        @Index(name = "idx_task_assignees_user_id", columnList = "user_id")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskAssignee {

    public static final String ROLE_LEAD = "LEAD";
    public static final String ROLE_CO = "CO_ASSIGNEE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** LEAD | CO_ASSIGNEE */
    @Column(name = "role", nullable = false, length = 20)
    @Builder.Default
    private String role = ROLE_CO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
