package api.v1.tm.dtos.responses;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@RegisterForReflection
public class TaskDependencyResponse {
    private Long taskId;
    private String taskTitle;
    private String status;
    /** True when this dependency is resolved or done (unblocks dependents). */
    private boolean satisfied;
}
