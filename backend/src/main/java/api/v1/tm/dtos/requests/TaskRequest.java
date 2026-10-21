package api.v1.tm.dtos.requests;

import api.v1.tm.validation.ValidPriority;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.FutureOrPresent;
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

    /** Primary lead — immutable internal {@code app_users.id}. */
    @NotNull(message = "Assigned user ID (lead) is required")
    private Long assignedTo;

    /** Optional co-assignees (employees). Lead must not be repeated here. */
    private java.util.List<Long> coAssignees;

    /** Optional tasks that must be resolved/done before this task can start. */
    private java.util.List<Long> dependsOnTaskIds;

    @ValidPriority
    private String priority = "medium";

    @FutureOrPresent(message = "Due date cannot be in the past")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate dueDate;
}
