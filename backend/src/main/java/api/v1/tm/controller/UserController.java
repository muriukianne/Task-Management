package api.v1.tm.controller;

import org.eclipse.microprofile.jwt.JsonWebToken;

import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.LoginRequest;
import api.v1.tm.dtos.responses.ResponseArray;
import api.v1.tm.services.UserService;
import api.v1.tm.utils.ResponseManager;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.annotation.security.PermitAll;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Path("/tm/api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequiredArgsConstructor
public final class UserController {
    private final UserService userService;
    private final JsonWebToken jwt;
    private final ResponseManager responseManager;

    @POST
    @Blocking
    @Path("/create")
    @Authenticated
    public Uni<ResponseArray<?>> createUser(@Valid CreateUserRequest request) {
        String userId = jwt.getSubject();
        if (userId == null) {
            return responseManager.onHandleErrorResponse("Invalid token: Missing subject claim");
        }
        log.info("Create user requested by: {}", userId);
        return this.userService.createUser(request);
    }

    @GET
    @Blocking
    @Path("/get-users")
    @Authenticated
    public Uni<ResponseArray<?>> getUsers() {
        String userId = jwt.getSubject();
        if (userId == null) {
            return responseManager.onHandleErrorResponse("Invalid token: Missing subject claim");
        }
        log.info("Get users requested by: {}", userId);
        return this.userService.getUsers();
    }

    @POST
    @Blocking
    @PermitAll
    @Path("/login")
    public Uni<ResponseArray<?>> login(@Valid LoginRequest request) {
        log.info("Login attempt for: {}", request.getEmail());
        return this.userService.login(request);
    }
}
