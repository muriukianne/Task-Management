package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@RegisterForReflection
public class TaskRequest {
    @NotBlank(message = "Task title is required")
    private String taskTitle;
    @NotBlank(message = "Task description is required")
    private String taskDescription;
    @NotBlank(message = "Assigned to is required")
    private String assignedTo;
}
