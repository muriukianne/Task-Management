package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@RegisterForReflection
public class AssignTaskRequest {
    @NotNull(message = "Task id is required")
    private Long taskId;

    /** New primary lead — immutable internal {@code app_users.id}. */
    @NotNull(message = "Assigned to (lead) is required")
    private Long assignedTo;

    /** Full co-assignee set to replace (employees). Lead must not be included. */
    private java.util.List<Long> coAssignees;
}
