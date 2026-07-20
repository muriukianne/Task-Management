package api.v1.tm.security;

import api.v1.tm.entity.AppUser;
import jakarta.enterprise.context.RequestScoped;

/**
 * Holds the provisioned {@code app_users} row for the current request.
 * Populated by {@code UserProvisioningFilter}.
 */
@RequestScoped
public class CurrentAppUser {

    private AppUser user;

    public void set(AppUser user) {
        this.user = user;
    }

    public AppUser get() {
        return user;
    }

    public Long getId() {
        return user != null ? user.getId() : null;
    }

    public String getRole() {
        return user != null ? user.getRole() : null;
    }
}
