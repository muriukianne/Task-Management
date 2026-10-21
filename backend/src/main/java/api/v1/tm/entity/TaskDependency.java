package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "task_dependencies",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_task_dependency",
        columnNames = {"task_id", "depends_on_task_id"}
    ),
    indexes = {
        @Index(name = "idx_task_deps_task_id", columnList = "task_id"),
        @Index(name = "idx_task_deps_depends_on", columnList = "depends_on_task_id")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskDependency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The blocked / dependent task. */
    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /** Must be resolved/done before {@link #taskId} can start. */
    @Column(name = "depends_on_task_id", nullable = false)
    private Long dependsOnTaskId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
