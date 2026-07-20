package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@RegisterForReflection
public class AssignTaskRequest {
    @NotNull(message = "Task id is required")
    private Long taskId;

    /** Immutable internal {@code app_users.id} of the assignee. */
    @NotNull(message = "Assigned to is required")
    private Long assignedTo;
}
