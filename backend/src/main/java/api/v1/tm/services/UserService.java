package api.v1.tm.services;

import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.LoginRequest;
import api.v1.tm.dtos.responses.ResponseArray;
import io.smallrye.mutiny.Uni;

public interface UserService {
    Uni<ResponseArray<?>> createUser(CreateUserRequest request);
    Uni<ResponseArray<?>> getUsers();
    Uni<ResponseArray<?>> login(LoginRequest request);
}
