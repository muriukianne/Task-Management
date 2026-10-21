package api.v1.tm.controller;

import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.SyncUserRequest;
import api.v1.tm.dtos.requests.UpdateOwnProfileRequest;
import api.v1.tm.dtos.requests.UpdateUserRequest;
import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.security.CurrentAppUser;
import api.v1.tm.services.UserService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Path("/tm/api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CurrentAppUser currentAppUser;

    @POST
    @Path("/create")
    @Blocking
    @Authenticated
    public Uni<Response> createUser(@Valid CreateUserRequest request) {
        return userService.createUser(request)
                .map(created -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(created))
                        .build());
    }

    /**
     * Lists all registered application users (used by Assign-To dropdowns).
     * Canonical path: {@code GET /tm/api/v1/users}
     */
    @GET
    @Blocking
    @Authenticated
    public Response listUsers() {
        return Response.ok(ApiResponse.success(userService.getUsers())).build();
    }

    /** Legacy alias kept for older clients. */
    @GET
    @Path("/get-users")
    @Blocking
    @Authenticated
    public Response getUsers() {
        return listUsers();
    }

    @GET
    @Path("/{id}")
    @Blocking
    @Authenticated
    public Response getUser(@PathParam("id") Long id) {
        return Response.ok(ApiResponse.success(userService.getUser(id))).build();
    }

    @PUT
    @Path("/me")
    @Blocking
    @Authenticated
    public Uni<Response> updateOwnProfile(@Valid UpdateOwnProfileRequest request) {
        return userService.updateOwnProfile(request)
                .map(user -> {
                    currentAppUser.set(user);
                    return Response.ok(ApiResponse.success("Profile updated", user)).build();
                });
    }

    @PUT
    @Path("/{id}")
    @Blocking
    @Authenticated
    public Uni<Response> updateUser(@PathParam("id") Long id, @Valid UpdateUserRequest request) {
        return userService.updateUser(id, request)
                .map(user -> Response.ok(ApiResponse.success("User updated", user)).build());
    }

    @DELETE
    @Path("/{id}")
    @Blocking
    @Authenticated
    public Uni<Response> deleteUser(@PathParam("id") Long id) {
        return userService.deleteUser(id)
                .map(v -> Response.ok(ApiResponse.success("User deleted", null)).build());
    }

    /**
     * Silently provisions the authenticated Clerk user into {@code app_users}
     * if they are missing, then returns the synchronized profile.
     * Optional body supplies email/name when the JWT template omits those claims.
     */
    @POST
    @Path("/sync")
    @Blocking
    @Authenticated
    public Uni<Response> syncUser(@Valid SyncUserRequest profile) {
        AppUser user = userService.ensureCurrentUser(profile);
        currentAppUser.set(user);
        return Uni.createFrom().item(Response.ok(ApiResponse.success(user)).build());
    }

    /**
     * Password-grant login against the legacy cloud database has been removed.
     * Clients must obtain a standard OIDC JWT from the identity provider and
     * send it as {@code Authorization: Bearer <token>} on API requests.
     */
    @POST
    @Path("/login")
    @Blocking
    public Response loginRemoved() {
        return Response.status(Response.Status.GONE)
                .entity(ApiResponse.error(410,
                        "Password login has been removed. Authenticate with your OIDC provider "
                        + "and send the access token as a Bearer JWT."))
                .build();
    }
}
