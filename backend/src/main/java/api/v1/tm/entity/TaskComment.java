package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "task_comments",
    indexes = {
        @Index(name = "idx_task_comments_task_id", columnList = "task_id"),
        @Index(name = "idx_task_comments_task_created", columnList = "task_id, created_at")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /** Immutable {@link AppUser#id} of the comment author. */
    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
