package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@RegisterForReflection
public class CreateCommentRequest {

    @NotBlank(message = "Comment body is required")
    @Size(min = 1, max = 4000, message = "Comment must be between 1 and 4000 characters")
    private String body;
}
