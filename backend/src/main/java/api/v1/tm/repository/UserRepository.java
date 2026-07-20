package api.v1.tm.repository;

import api.v1.tm.entity.AppUser;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class UserRepository implements PanacheRepositoryBase<AppUser, Long> {

    public Optional<AppUser> findByEmail(String email) {
        return find("email", email).firstResultOptional();
    }

    public Optional<AppUser> findByClerkId(String clerkId) {
        return find("clerkId", clerkId).firstResultOptional();
    }
}
