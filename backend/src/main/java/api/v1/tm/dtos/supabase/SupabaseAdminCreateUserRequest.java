package api.v1.tm.dtos.supabase;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
public class SupabaseAdminCreateUserRequest {
    private String email;
    private String password;
    @JsonProperty("email_confirm")
    private boolean emailConfirm;
    @JsonProperty("user_metadata")
    private UserMetadata userMetadata;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @RegisterForReflection
    public static class UserMetadata {
        @JsonProperty("full_name")
        private String fullName;
        private String role;
    }
}
