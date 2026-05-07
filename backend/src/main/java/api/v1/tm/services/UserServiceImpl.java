package api.v1.tm.services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import api.v1.tm.Auth.AuthClient;
import api.v1.tm.config.ApplicationProperties;
import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.LoginRequest;
import api.v1.tm.dtos.responses.CreatedUserResponse;
import api.v1.tm.dtos.responses.ResponseArray;
import api.v1.tm.dtos.supabase.SupabaseAdminCreateUserRequest;
import api.v1.tm.dtos.supabase.SupabaseUsersListResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.utils.ResponseManager;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final java.util.Set<String> ALLOWED_ROLES = java.util.Set.of("admin", "supervisor", "employee");

    private final ResponseManager responseManager;
    private final ApplicationProperties applicationProperties;
    private final JsonWebToken jwt;
    private final UserRepository userRepository;

    @Inject
    @RestClient
    AuthClient authClient;

    @ConfigProperty(name = "supabase.apikey")
    String apiKey;

    @Override
    public Uni<ResponseArray<?>> createUser(CreateUserRequest request) {
        String roleName = request.getRole().trim().toLowerCase();
        if (!ALLOWED_ROLES.contains(roleName)) {
            return responseManager.onHandleErrorResponse("Role must be one of: admin, supervisor, employee");
        }

        String callerRole = callerRoleFromJwt();
        if (callerRole == null) {
            return responseManager.onHandleErrorResponse("Could not determine your role — make sure your token is valid");
        }
        if (!"admin".equals(callerRole) && !"supervisor".equals(callerRole)) {
            return responseManager.onHandleErrorResponse("Only admins and supervisors can create user accounts");
        }
        if ("supervisor".equals(callerRole) && !"employee".equals(roleName)) {
            return responseManager.onHandleErrorResponse("Supervisors can only create employee accounts");
        }

        String fullName = request.getFirstName().trim() + " " + request.getLastName().trim();
        String bearer = "Bearer " + apiKey.trim();
        SupabaseAdminCreateUserRequest body = SupabaseAdminCreateUserRequest.builder()
                .email(request.getEmail().trim())
                .password(request.getPassword())
                .emailConfirm(true)
                .userMetadata(SupabaseAdminCreateUserRequest.UserMetadata.builder()
                        .fullName(fullName)
                        .role(roleName)
                        .build())
                .build();

        return authClient.adminCreateUser(bearer, apiKey.trim(), body)
                .onItem().transformToUni(response -> {
                    if (response.getId() == null) {
                        return Uni.createFrom().failure(badRequest(
                                "User creation did not return an ID; check Supabase Auth settings"));
                    }
                    String email = response.getEmail() != null ? response.getEmail() : request.getEmail().trim();
                    CreatedUserResponse created = CreatedUserResponse.builder()
                            .id(response.getId())
                            .email(email)
                            .build();
                    saveUserLocally(response.getId(), email,
                            request.getFirstName().trim(), request.getLastName().trim(), roleName);
                    return responseManager.onHandleSuccessResponse(created);
                })
                .onFailure().recoverWithUni(err -> {
                    log.error("Supabase admin create user failed", err);
                    return Uni.createFrom().failure(badRequest(mapAdminCreateError(err)));
                });
    }

    @Override
    public Uni<ResponseArray<?>> getUsers() {
        String bearer = "Bearer " + apiKey.trim();
        return authClient.listUsers(bearer, apiKey.trim())
                .onItem().transformToUni(resp -> {
                    List<AppUser> users = Optional.ofNullable(resp.getUsers())
                            .orElse(List.of())
                            .stream()
                            .filter(u -> u.getUserMetadata() != null
                                    && u.getUserMetadata().getRole() != null
                                    && !u.getUserMetadata().getRole().isBlank())
                            .map(this::toAppUser)
                            .collect(Collectors.toList());
                    log.info("Returning {} users from Supabase admin API", users.size());
                    return responseManager.onHandleSuccessResponse(users);
                })
                .onFailure().recoverWithUni(err -> {
                    log.warn("Supabase admin list failed: {}. Falling back to local DB.", err.getMessage());
                    List<AppUser>[] holder = new List[]{List.of()};
                    try {
                        QuarkusTransaction.requiringNew().run(() -> holder[0] = userRepository.listAll());
                    } catch (Exception e) {
                        log.error("Local DB fallback also failed: {}", e.getMessage());
                    }
                    return responseManager.onHandleSuccessResponse(holder[0]);
                });
    }

    @Override
    public Uni<ResponseArray<?>> login(LoginRequest request) {
        log.info("Attempting login for: {}", request.getEmail());
        Map<String, String> credentials = Map.of(
                "email", request.getEmail(),
                "password", request.getPassword()
        );
        return authClient.login("password", apiKey, credentials)
                .onItem().transformToUni(authResponse -> {
                    log.info("Login successful for: {}", request.getEmail());
                    return responseManager.onHandleSuccessResponse("Login successful", authResponse);
                })
                .onFailure().recoverWithUni(err -> {
                    log.error("Login failed for: {}. Error: {}", request.getEmail(), err.getMessage());
                    return responseManager.onHandleErrorResponse("Invalid credentials");
                });
    }

    private AppUser toAppUser(SupabaseUsersListResponse.SupabaseUser su) {
        String fullName = su.getUserMetadata().getFullName() != null
                ? su.getUserMetadata().getFullName() : "";
        String[] parts = fullName.split(" ", 2);
        return AppUser.builder()
                .userId(su.getId())
                .email(su.getEmail() != null ? su.getEmail() : "")
                .firstName(parts[0])
                .lastName(parts.length > 1 ? parts[1] : "")
                .role(su.getUserMetadata().getRole())
                .build();
    }

    void saveUserLocally(String id, String email, String firstName, String lastName, String role) {
        try {
            QuarkusTransaction.requiringNew().run(() -> {
                AppUser user = AppUser.builder()
                        .userId(id)
                        .email(email)
                        .firstName(firstName)
                        .lastName(lastName)
                        .role(role)
                        .createdAt(LocalDateTime.now())
                        .build();
                userRepository.persist(user);
            });
            log.info("User {} cached in local DB", email);
        } catch (Exception e) {
            log.warn("Could not cache user {} in local DB (may already exist): {}", email, e.getMessage());
        }
    }

    private String callerRoleFromJwt() {
        Object meta = jwt.getClaim("user_metadata");
        if (meta instanceof JsonObject jo) {
            JsonString role = jo.getJsonString("role");
            if (role != null && !role.getString().isBlank()) {
                return role.getString().trim().toLowerCase();
            }
        }
        log.warn("callerRoleFromJwt: user_metadata.role not found in JWT");
        return null;
    }

    private WebApplicationException badRequest(String message) {
        ResponseArray<?> body = ResponseArray.builder()
                .code(applicationProperties.validateErrorCode())
                .msg(message)
                .build();
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
                .entity(body)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .build());
    }

    private String mapAdminCreateError(Throwable err) {
        Throwable t = err;
        for (int i = 0; i < 10 && t.getCause() != null && t.getCause() != t; i++) {
            if (t instanceof WebApplicationException) break;
            t = t.getCause();
        }
        if (t instanceof WebApplicationException wae) {
            Response r = wae.getResponse();
            if (r != null && r.hasEntity()) {
                try {
                    return "User creation failed: " + r.readEntity(String.class);
                } catch (Exception e) {
                    log.debug("Could not read Supabase error body", e);
                }
                return "User creation failed: HTTP " + r.getStatus();
            }
            return "User creation failed: HTTP " + (r != null ? r.getStatus() : wae.getMessage());
        }
        return "User creation failed: " + err.getMessage();
    }
}
