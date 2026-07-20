package api.v1.tm.utils;

import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.security.CurrentAppUser;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Request-scoped helper that centralises JWT claim extraction for standard OIDC tokens.
 * Supports both top-level claims ({@code role}, {@code full_name}, {@code email}) and
 * nested {@code user_metadata} / {@code public_metadata} for Clerk.
 *
 * <p>When {@link CurrentAppUser} has been provisioned for the request, its DB role
 * (synced from the JWT by {@code ensureCurrentUser}) is preferred for authorization
 * checks within the same request.
 */
@Slf4j
@RequestScoped
public class JwtHelper {

    @Inject
    JsonWebToken jwt;

    @Inject
    CurrentAppUser currentAppUser;

    /** Clerk JWT {@code sub} — identity provider subject, not the DB primary key. */
    public String getUserId() {
        return jwt.getSubject();
    }

    /**
     * Immutable internal {@code app_users.id} for the provisioned caller.
     * Requires {@link CurrentAppUser} to have been set by the provisioning filter.
     */
    public Long getAppUserId() {
        Long id = currentAppUser != null ? currentAppUser.getId() : null;
        if (id == null) {
            throw new AccessDeniedException("Local user is not provisioned for this request");
        }
        return id;
    }

    public String getEmail() {
        String email = findClaimEmail();
        if (email != null) {
            return email;
        }
        return getUserId() + "@local";
    }

    /**
     * Real email from JWT claims only — {@code null} when the token omits email
     * (common with incomplete Clerk JWT templates).
     */
    public String findClaimEmail() {
        String email = claimAsString("email");
        if (email != null && !email.isBlank() && email.contains("@")) {
            return email.trim().toLowerCase();
        }
        email = claimAsString("primary_email_address");
        if (email != null && !email.isBlank() && email.contains("@")) {
            return email.trim().toLowerCase();
        }
        email = metadataString("email");
        if (email != null && !email.isBlank() && email.contains("@")) {
            return email.trim().toLowerCase();
        }
        String preferred = claimAsString("preferred_username");
        if (preferred != null && preferred.contains("@")) {
            return preferred.trim().toLowerCase();
        }
        return null;
    }

    public boolean hasRealEmail() {
        return findClaimEmail() != null;
    }

    public String getFullName() {
        String fullName = claimAsString("full_name");
        if (fullName == null || fullName.isBlank()) {
            fullName = claimAsString("name");
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = metadataString("full_name");
        }
        if (fullName == null || fullName.isBlank()) {
            String given = claimAsString("given_name");
            String family = claimAsString("family_name");
            if (given != null || family != null) {
                fullName = ((given != null ? given : "") + " " + (family != null ? family : "")).trim();
            }
        }
        return fullName != null ? fullName.trim() : "";
    }

    public String getFirstName() {
        String given = claimAsString("given_name");
        if (given != null && !given.isBlank()) {
            return given.trim();
        }
        String[] parts = getFullName().split(" ", 2);
        return parts[0].isBlank() ? "User" : parts[0];
    }

    public String getLastName() {
        String family = claimAsString("family_name");
        if (family != null && !family.isBlank()) {
            return family.trim();
        }
        String[] parts = getFullName().split(" ", 2);
        return parts.length > 1 ? parts[1] : "";
    }

    /**
     * Role from the JWT / metadata only (ignores the provisioned {@code app_users} row).
     * Used when creating or upgrading a local user from OIDC claims.
     */
    public String getTokenRole() {
        String role = claimAsString("role");
        if (role != null && !role.isBlank() && !"authenticated".equalsIgnoreCase(role)) {
            return role.trim().toLowerCase();
        }
        role = metadataString("role");
        if (role != null && !role.isBlank()) {
            return role.trim().toLowerCase();
        }
        return "employee";
    }

    public String getRole() {
        String dbRole = currentAppUser != null ? currentAppUser.getRole() : null;
        if (dbRole != null && !dbRole.isBlank()) {
            return dbRole.trim().toLowerCase();
        }
        return getTokenRole();
    }

    public boolean isAdmin() {
        return "admin".equals(getRole());
    }

    public boolean isSupervisor() {
        return "supervisor".equals(getRole());
    }

    public boolean isEmployee() {
        return "employee".equals(getRole());
    }

    /** admin OR supervisor */
    public boolean isPrivileged() {
        return isAdmin() || isSupervisor();
    }

    /** Throws AccessDeniedException (HTTP 403) if the caller is not privileged. */
    public void requirePrivileged(String action) {
        if (!isPrivileged()) {
            throw new AccessDeniedException("Only supervisors and admins can " + action);
        }
    }

    /** Throws AccessDeniedException (HTTP 403) if the caller is not an admin. */
    public void requireAdmin(String action) {
        if (!isAdmin()) {
            throw new AccessDeniedException("Only admins can " + action);
        }
    }

    private String claimAsString(String name) {
        Object value = jwt.getClaim(name);
        if (value == null) {
            return null;
        }
        if (value instanceof JsonString js) {
            return js.getString();
        }
        if (value instanceof String s) {
            return s;
        }
        return value.toString();
    }

    private String metadataString(String key) {
        Object meta = jwt.getClaim("user_metadata");
        if (meta instanceof JsonObject jo) {
            JsonValue value = jo.get(key);
            if (value instanceof JsonString js) {
                return js.getString();
            }
        }
        // Clerk often stores app roles under public_metadata
        Object pub = jwt.getClaim("public_metadata");
        if (pub instanceof JsonObject jo) {
            JsonValue value = jo.get(key);
            if (value instanceof JsonString js) {
                return js.getString();
            }
        }
        return null;
    }
}
