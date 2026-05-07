package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@RegisterForReflection
public class UpdateStatusRequest {
    @NotBlank(message = "New status is required")
    private String newStatus;
}
