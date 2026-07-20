package api.v1.tm.dtos.requests;

import api.v1.tm.validation.ValidTaskStatus;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@RegisterForReflection
public class UpdateStatusRequest {

    @NotBlank(message = "New status is required")
    @ValidTaskStatus
    private String newStatus;
}
