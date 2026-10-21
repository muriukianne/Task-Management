package api.v1.tm.entity;

import api.v1.tm.dtos.responses.TaskAssigneeResponse;
import api.v1.tm.dtos.responses.TaskDependencyResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;

import java.io.Serial;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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

    /** Primary lead — immutable {@link AppUser#id}. Mirrored as LEAD in task_assignees. */
    @Column(name = "assigned_to", nullable = false)
    private Long assignedTo;

    /** Immutable {@link AppUser#id} of the assigner. */
    @Column(name = "assigned_by", nullable = false)
    private Long assignedBy;

    @Column(name = "attached_file")
    private String attachedFile;

    /**
     * Optimistic concurrency token. Incremented on every successful update.
     * Clients should send the last-seen value on mutating requests so stale writes
     * fail with HTTP 409 instead of silently overwriting concurrent changes.
     */
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * When a co-assignee submits work for lead review ({@code pending_approval}),
     * stores the co-assignee's user id. Cleared when lead approves or sends back.
     */
    @Column(name = "approval_requested_by")
    private Long approvalRequestedBy;

    /** Populated for API responses — lead + co-assignees. */
    @Transient
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @Builder.Default
    private List<TaskAssigneeResponse> assignees = new ArrayList<>();

    /**
     * Caller's role on this task for the current request: {@code LEAD}, {@code CO_ASSIGNEE}, or null.
     */
    @Transient
    private String viewerAssigneeRole;

    /** Tasks this one depends on (must be resolved/done before start). */
    @Transient
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @Builder.Default
    private List<TaskDependencyResponse> dependencies = new ArrayList<>();

    /** Tasks blocked by this one. */
    @Transient
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @Builder.Default
    private List<TaskDependencyResponse> dependents = new ArrayList<>();

    /** True when any dependency is not yet resolved/done. */
    @Transient
    @Builder.Default
    private boolean blocked = false;
}
