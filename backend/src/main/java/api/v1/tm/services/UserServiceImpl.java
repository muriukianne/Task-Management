package api.v1.tm.services;

import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.SyncUserRequest;
import api.v1.tm.dtos.requests.UpdateUserRequest;
import api.v1.tm.dtos.responses.CreatedUserResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.BusinessException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.utils.JwtHelper;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final JwtHelper jwt;

    // ── Create user (local app_users only — identity is OIDC) ─────────────────

    @Override
    @Transactional
    public Uni<CreatedUserResponse> createUser(CreateUserRequest request) {
        String targetRole = request.getRole().trim().toLowerCase();

        if (!jwt.isPrivileged()) {
            throw new AccessDeniedException("Only admins and supervisors can create user accounts");
        }
        if (jwt.isSupervisor() && !"employee".equals(targetRole)) {
            throw new AccessDeniedException("Supervisors can only create employee accounts");
        }

        String email = request.getEmail().trim().toLowerCase();
        var existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            String existingRole = existing.get().getRole();
            throw new BusinessException(
                    "A user with email '" + email + "' already exists (role: " + existingRole + "). "
                    + ("employee".equals(existingRole)
                            ? "They should appear under Team and in the Assign To list."
                            : "Use a different email to create an employee account."));
        }

        // clerk_id stays null until first login — internal id is the stable FK target
        AppUser user = AppUser.builder()
                .email(email)
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .role(targetRole)
                .createdAt(LocalDateTime.now())
                .build();
        userRepository.persist(user);

        log.info("Local user created: {} [role={}, id={}]", email, targetRole, user.getId());
        return Uni.createFrom().item(CreatedUserResponse.builder()
                .id(user.getId())
                .email(email)
                .build());
    }

    // ── List / get users ──────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<List<AppUser>> getUsers() {
        jwt.requirePrivileged("list users");
        return Uni.createFrom().item(userRepository.listAll());
    }

    @Override
    @Transactional
    public Uni<AppUser> getUser(Long id) {
        jwt.requirePrivileged("view users");
        AppUser user = requireManagedUser(id);
        return Uni.createFrom().item(user);
    }

    // ── Update user ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<AppUser> updateUser(Long id, UpdateUserRequest request) {
        jwt.requirePrivileged("update users");

        AppUser user = requireManagedUser(id);
        String targetRole = request.getRole().trim().toLowerCase();

        if (jwt.isSupervisor()) {
            if (!"employee".equalsIgnoreCase(user.getRole())) {
                throw new AccessDeniedException("Supervisors can only update employee accounts");
            }
            if (!"employee".equals(targetRole)) {
                throw new AccessDeniedException("Supervisors can only assign the employee role");
            }
        }

        String email = request.getEmail().trim().toLowerCase();
        userRepository.findByEmail(email).ifPresent(other -> {
            if (!other.getId().equals(id)) {
                throw new BusinessException("A user with email '" + email + "' already exists");
            }
        });

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(email);
        user.setRole(targetRole);

        log.info("Updated user id={} ({}) role={}", id, email, targetRole);
        return Uni.createFrom().item(user);
    }

    // ── Delete user ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Void> deleteUser(Long id) {
        jwt.requirePrivileged("delete users");

        AppUser user = requireManagedUser(id);

        if (jwt.isSupervisor() && !"employee".equalsIgnoreCase(user.getRole())) {
            throw new AccessDeniedException("Supervisors can only delete employee accounts");
        }

        Long callerId = jwt.getAppUserId();
        if (callerId.equals(id)) {
            throw new BusinessException("You cannot delete your own account");
        }

        long taskCount = taskRepository.countByUserInvolved(id);
        if (taskCount > 0) {
            throw new BusinessException(
                    "Cannot delete this member — they are linked to " + taskCount
                    + " task(s). Reassign or complete those tasks first.");
        }

        userRepository.delete(user);
        log.info("Deleted user id={} ({})", id, user.getEmail());
        return Uni.createFrom().voidItem();
    }

    // ── JWT → local app_users provisioning ────────────────────────────────────

    @Override
    @Transactional
    public AppUser ensureCurrentUser(SyncUserRequest profile) {
        String clerkId = jwt.getUserId();
        if (clerkId == null || clerkId.isBlank()) {
            throw new AccessDeniedException("Authenticated token is missing a subject (sub) claim");
        }

        String resolvedEmail = resolveEmail(profile);

        Optional<AppUser> byClerk = userRepository.findByClerkId(clerkId);
        if (byClerk.isPresent()) {
            return finalizeLinkedUser(byClerk.get(), resolvedEmail, profile);
        }

        if (resolvedEmail != null) {
            Optional<AppUser> byEmail = userRepository.findByEmail(resolvedEmail);
            if (byEmail.isPresent()) {
                return linkInvite(byEmail.get(), clerkId, profile);
            }
        }

        return createFromJwt(clerkId, resolvedEmail, profile);
    }

    /**
     * Prefer JWT email; fall back to client-provided Clerk profile email when the
     * JWT template omits it (avoids orphan {@code sub@local} rows that never see tasks).
     */
    private String resolveEmail(SyncUserRequest profile) {
        String fromJwt = jwt.findClaimEmail();
        if (fromJwt != null) {
            return fromJwt;
        }
        if (profile != null && profile.getEmail() != null && !profile.getEmail().isBlank()) {
            String fromClient = profile.getEmail().trim().toLowerCase();
            if (fromClient.contains("@") && !fromClient.endsWith("@local")) {
                return fromClient;
            }
        }
        return null;
    }

    /**
     * Caller already linked by clerk_id. If they were auto-provisioned as {@code sub@local}
     * and a Team invite exists for their real email, merge onto the invite (keeps task FKs).
     */
    private AppUser finalizeLinkedUser(AppUser existing, String resolvedEmail, SyncUserRequest profile) {
        if (resolvedEmail != null && isSyntheticEmail(existing.getEmail())
                && !resolvedEmail.equalsIgnoreCase(existing.getEmail())) {
            Optional<AppUser> invite = userRepository.findByEmail(resolvedEmail);
            if (invite.isPresent() && !invite.get().getId().equals(existing.getId())) {
                AppUser target = invite.get();
                if (target.getClerkId() == null || target.getClerkId().isBlank()
                        || target.getClerkId().equals(existing.getClerkId())) {
                    return mergeOrphanIntoInvite(existing, target);
                }
            }
            // No invite — upgrade the orphan row to the real email
            if (userRepository.findByEmail(resolvedEmail).isEmpty()) {
                existing.setEmail(resolvedEmail);
            }
        }

        enrichFromProfile(existing, profile);
        return syncRoleFromToken(existing);
    }

    private AppUser linkInvite(AppUser invite, String clerkId, SyncUserRequest profile) {
        if (invite.getClerkId() != null && !invite.getClerkId().isBlank()
                && !clerkId.equals(invite.getClerkId())) {
            throw new BusinessException(
                    "Email '" + invite.getEmail() + "' is already linked to a different Clerk account");
        }
        invite.setClerkId(clerkId);
        enrichFromProfile(invite, profile);
        log.info("Linked local user id={} ({}) to Clerk subject {}",
                invite.getId(), invite.getEmail(), clerkId);
        return syncRoleFromToken(invite);
    }

    /**
     * Move identity onto the invite row (task FKs already point at invite.id), then drop the orphan.
     * Clears the orphan's {@code clerk_id} first so the unique index is not violated mid-merge.
     */
    private AppUser mergeOrphanIntoInvite(AppUser orphan, AppUser invite) {
        if (taskRepository.countByUserInvolved(orphan.getId()) > 0) {
            throw new BusinessException(
                    "Your account could not be linked to the team invite because the temporary "
                    + "profile still has tasks. Ask a supervisor for help.");
        }
        String clerkId = orphan.getClerkId();
        orphan.setClerkId(null);
        userRepository.flush();

        invite.setClerkId(clerkId);
        if (invite.getFirstName() == null || invite.getFirstName().isBlank()
                || "User".equalsIgnoreCase(invite.getFirstName())) {
            invite.setFirstName(orphan.getFirstName());
        }
        if (invite.getLastName() == null || invite.getLastName().isBlank()) {
            invite.setLastName(orphan.getLastName());
        }
        userRepository.delete(orphan);
        userRepository.flush();
        log.info("Merged orphan app_users id={} into invite id={} ({})",
                orphan.getId(), invite.getId(), invite.getEmail());
        return syncRoleFromToken(invite);
    }

    private AppUser createFromJwt(String clerkId, String resolvedEmail, SyncUserRequest profile) {
        String email = resolvedEmail != null ? resolvedEmail : (clerkId + "@local");
        String first = firstNonBlank(
                profile != null ? profile.getFirstName() : null,
                jwt.getFirstName());
        String last = firstNonBlank(
                profile != null ? profile.getLastName() : null,
                jwt.getLastName());

        AppUser user = AppUser.builder()
                .clerkId(clerkId)
                .email(email)
                .firstName(first != null ? first : "User")
                .lastName(last != null ? last : "")
                .role(jwt.getTokenRole())
                .createdAt(LocalDateTime.now())
                .build();
        userRepository.persist(user);
        log.info("Auto-provisioned app_users id={} for Clerk subject {} ({})",
                user.getId(), clerkId, user.getEmail());
        return user;
    }

    private void enrichFromProfile(AppUser user, SyncUserRequest profile) {
        if (profile == null) {
            return;
        }
        if (profile.getFirstName() != null && !profile.getFirstName().isBlank()) {
            if (user.getFirstName() == null || user.getFirstName().isBlank()
                    || "User".equalsIgnoreCase(user.getFirstName())) {
                user.setFirstName(profile.getFirstName().trim());
            }
        }
        if (profile.getLastName() != null && !profile.getLastName().isBlank()) {
            if (user.getLastName() == null || user.getLastName().isBlank()) {
                user.setLastName(profile.getLastName().trim());
            }
        }
    }

    private static boolean isSyntheticEmail(String email) {
        return email == null || email.isBlank() || email.toLowerCase().endsWith("@local");
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a.trim();
        if (b != null && !b.isBlank()) return b.trim();
        return null;
    }

    /**
     * Load user and enforce supervisor scope (employees only).
     */
    private AppUser requireManagedUser(Long id) {
        AppUser user = userRepository.findByIdOptional(id)
                .orElseThrow(() -> ResourceNotFoundException.user(id));
        if (jwt.isSupervisor() && !"employee".equalsIgnoreCase(user.getRole())) {
            throw new AccessDeniedException("Supervisors can only manage employee accounts");
        }
        return user;
    }

    /**
     * Clerk (JWT role claim) is the source of truth for access level.
     */
    private AppUser syncRoleFromToken(AppUser existing) {
        String tokenRole = jwt.getTokenRole();
        if (!tokenRole.equalsIgnoreCase(existing.getRole())) {
            log.info("Syncing {} role {} → {} from JWT (Clerk is source of truth)",
                    existing.getEmail(), existing.getRole(), tokenRole);
            existing.setRole(tokenRole);
        }
        return existing;
    }
}
