package api.v1.tm.dtos.supabase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@RegisterForReflection
public class SupabaseAdminUserResponse {
    private String id;
    private String email;
}
