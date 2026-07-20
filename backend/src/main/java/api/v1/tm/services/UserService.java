package api.v1.tm.services;

import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.SyncUserRequest;
import api.v1.tm.dtos.requests.UpdateUserRequest;
import api.v1.tm.dtos.responses.CreatedUserResponse;
import api.v1.tm.entity.AppUser;
import io.smallrye.mutiny.Uni;

import java.util.List;

public interface UserService {

    Uni<CreatedUserResponse> createUser(CreateUserRequest request);

    Uni<List<AppUser>> getUsers();

    Uni<AppUser> getUser(Long id);

    Uni<AppUser> updateUser(Long id, UpdateUserRequest request);

    Uni<Void> deleteUser(Long id);

    /**
     * Ensures the caller (from the current OIDC JWT) has a row in {@code app_users}.
     * Creates the row on first authenticated API call when missing.
     * Optional {@code profile} supplies email/name when the JWT template omits them.
     */
    AppUser ensureCurrentUser(SyncUserRequest profile);
}
