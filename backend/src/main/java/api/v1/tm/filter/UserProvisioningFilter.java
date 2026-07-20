package api.v1.tm.filter;

import api.v1.tm.entity.AppUser;
import api.v1.tm.security.CurrentAppUser;
import api.v1.tm.services.UserService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * On every authenticated request, ensures the JWT subject exists in {@code app_users}.
 * Creates the local row automatically on the caller's first API hit.
 */
@Slf4j
@Provider
@Priority(Priorities.USER)
public class UserProvisioningFilter implements ContainerRequestFilter {

    @Inject
    SecurityIdentity identity;

    @Inject
    UserService userService;

    @Inject
    CurrentAppUser currentAppUser;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (identity == null || identity.isAnonymous()) {
            return;
        }
        // /users/sync accepts an optional Clerk profile body — let the controller provision
        String path = requestContext.getUriInfo().getPath();
        if (path != null && (path.endsWith("/users/sync") || path.endsWith("users/sync"))) {
            return;
        }
        try {
            AppUser user = userService.ensureCurrentUser(null);
            currentAppUser.set(user);
        } catch (Exception e) {
            log.error("Failed to provision local user from JWT: {}", e.getMessage());
            throw e;
        }
    }
}
