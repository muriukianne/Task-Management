package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Raw free-text input for natural-language task parsing.
 * Example: {@code "Finish API docs by Friday #backend high-priority"}
 */
@Data
@RegisterForReflection
public class ParseTaskTextRequest {

    @NotBlank(message = "Task text is required")
    @Size(min = 3, max = 2000, message = "Task text must be between 3 and 2000 characters")
    private String text;
}
