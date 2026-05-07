package api.v1.tm.dtos.supabase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@RegisterForReflection
public class SupabaseUsersListResponse {

    private List<SupabaseUser> users;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public static class SupabaseUser {
        private String id;
        private String email;
        @JsonProperty("user_metadata")
        private UserMeta userMetadata;

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        @RegisterForReflection
        public static class UserMeta {
            @JsonProperty("full_name")
            private String fullName;
            private String role;
        }
    }
}
