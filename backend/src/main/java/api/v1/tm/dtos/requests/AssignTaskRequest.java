package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@RegisterForReflection
public class AssignTaskRequest {
    @NotNull(message = "Task id is required")
    private Long taskId;
    @NotBlank(message = "Assigned to is required")
    private String assignedTo;
}
