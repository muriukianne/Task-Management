package api.v1.tm.Auth;

import java.util.Map;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import api.v1.tm.dtos.supabase.SupabaseAdminCreateUserRequest;
import api.v1.tm.dtos.supabase.SupabaseAdminUserResponse;
import api.v1.tm.dtos.supabase.SupabaseUsersListResponse;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@RegisterRestClient(configKey = "auth-client")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public interface AuthClient {

    @POST
    @Path("/token")
    Uni<Map<String, Object>> login(
        @QueryParam("grant_type") String grantType,
        @HeaderParam("apikey") String apiKey,
        Map<String, String> credentials
    );

    @POST
    @Path("/admin/users")
    Uni<SupabaseAdminUserResponse> adminCreateUser(
        @HeaderParam("Authorization") String authorization,
        @HeaderParam("apikey") String apiKey,
        SupabaseAdminCreateUserRequest body
    );

    @GET
    @Path("/admin/users")
    Uni<SupabaseUsersListResponse> listUsers(
        @HeaderParam("Authorization") String authorization,
        @HeaderParam("apikey") String apiKey
    );
}
