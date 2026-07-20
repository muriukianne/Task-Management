package api.v1.tm.dtos.requests;

import api.v1.tm.validation.ValidPriority;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
@RegisterForReflection
public class TaskRequest {

    @NotBlank(message = "Task title is required")
    @Size(min = 3, max = 200, message = "Task title must be between 3 and 200 characters")
    private String taskTitle;

    @NotBlank(message = "Task description is required")
    @Size(min = 10, max = 5000, message = "Task description must be between 10 and 5000 characters")
    private String taskDescription;

    /** Immutable internal {@code app_users.id} of the assignee. */
    @NotNull(message = "Assigned user ID is required")
    private Long assignedTo;

    @ValidPriority
    private String priority = "medium";

    @Future(message = "Due date must be in the future")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate dueDate;
}
