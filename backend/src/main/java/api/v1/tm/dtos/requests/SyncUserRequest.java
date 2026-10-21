package api.v1.tm.dtos.requests;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Optional name hints from the client (Clerk session) used when the JWT
 * omits given/family name. {@code email} is accepted for backward compatibility
 * but is never used as a join key — linking requires a verified JWT email claim.
 */
@Data
@RegisterForReflection
public class SyncUserRequest {

    @Email(message = "Must be a valid email address")
    @Size(max = 254, message = "Email must not exceed 254 characters")
    private String email;

    @Size(max = 100, message = "First name must not exceed 100 characters")
    private String firstName;

    @Size(max = 100, message = "Last name must not exceed 100 characters")
    private String lastName;
}
