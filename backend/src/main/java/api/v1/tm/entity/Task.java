package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serial;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Table(
    name = "tasks",
    indexes = {
        @Index(name = "idx_task_status",      columnList = "status"),
        @Index(name = "idx_task_assigned_to", columnList = "assigned_to"),
        @Index(name = "idx_task_priority",    columnList = "priority"),
        @Index(name = "idx_task_due_date",    columnList = "due_date"),
        @Index(name = "idx_task_assigned_status",   columnList = "assigned_to, status"),
        @Index(name = "idx_task_status_priority",   columnList = "status, priority")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Task {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "task_title", nullable = false, length = 200)
    private String taskTitle;

    @Column(name = "task_description", nullable = false, columnDefinition = "TEXT")
    private String taskDescription;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /** low | medium | high | critical — default medium */
    @Column(name = "priority", length = 10)
    @Builder.Default
    private String priority = "medium";

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** Immutable {@link AppUser#id} of the assignee. */
    @Column(name = "assigned_to", nullable = false)
    private Long assignedTo;

    /** Immutable {@link AppUser#id} of the assigner. */
    @Column(name = "assigned_by", nullable = false)
    private Long assignedBy;

    @Column(name = "attached_file")
    private String attachedFile;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
