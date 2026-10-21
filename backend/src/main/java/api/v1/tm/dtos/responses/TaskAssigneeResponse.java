package api.v1.tm.dtos.responses;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@RegisterForReflection
public class TaskAssigneeResponse {
    private Long userId;
    private String role;
    private String firstName;
    private String lastName;
    private String email;
}
