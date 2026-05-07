package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@RegisterForReflection
public class LoginRequest {
    @NotBlank(message = "email is required")
    private String email;
    @NotBlank(message = "Password is required")
    private String password;
}