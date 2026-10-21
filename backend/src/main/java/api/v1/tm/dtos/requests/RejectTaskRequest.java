package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Supervisor/admin rejection of a resolved task — returns it to in_progress with a required reason.
 */
@Data
@RegisterForReflection
public class RejectTaskRequest {

    @NotBlank(message = "Rejection reason is required")
    @Size(min = 3, max = 2000, message = "Rejection reason must be between 3 and 2000 characters")
    private String reason;
}
