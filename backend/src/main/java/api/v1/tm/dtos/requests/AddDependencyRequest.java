package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@RegisterForReflection
public class AddDependencyRequest {

    /** Task that must be resolved/done before the current task can start. */
    @NotNull(message = "dependsOnTaskId is required")
    private Long dependsOnTaskId;
}
