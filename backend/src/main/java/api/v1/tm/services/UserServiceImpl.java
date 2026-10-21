package api.v1.tm.services;

import api.v1.tm.activity.TaskActivityEvent;
import api.v1.tm.dtos.requests.CreateUserRequest;
import api.v1.tm.dtos.requests.SyncUserRequest;
import api.v1.tm.dtos.requests.UpdateOwnProfileRequest;
import api.v1.tm.dtos.requests.UpdateUserRequest;
import api.v1.tm.dtos.responses.CreatedUserResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.BusinessException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.security.CurrentAppUser;
import api.v1.tm.utils.JwtHelper;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
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
    private final CurrentAppUser currentAppUser;
    private final Event<TaskActivityEvent> activityEvents;

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

        activityEvents.fire(TaskActivityEvent.userCreated(
                jwt.getAppUserId(),
                user.getId(),
                email + " [" + targetRole + "]"));

        log.info("Local user created: {} [role={}, id={}]", email, targetRole, user.getId());
        return Uni.createFrom().item(CreatedUserResponse.builder()
                .id(user.getId())
                .email(email)
                .build());
    }

    // ── List / get users ──────────────────────────────────────────────────────

    @Override
    @Transactional
    public List<AppUser> getUsers() {
        jwt.requirePrivileged("list users");
        return userRepository.listAll();
    }

    @Override
    @Transactional
    public AppUser getUser(Long id) {
        jwt.requirePrivileged("view users");
        return requireManagedUser(id);
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

        String before = summary(user);
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(email);
        user.setRole(targetRole);

        activityEvents.fire(TaskActivityEvent.userUpdated(
                jwt.getAppUserId(), id, before, summary(user)));

        log.info("Updated user id={} ({}) role={} clerkId={}",
                id, email, targetRole, user.getClerkId());
        return Uni.createFrom().item(user);
    }

    @Override
    @Transactional
    public Uni<AppUser> updateOwnProfile(UpdateOwnProfileRequest request) {
        final Long callerId = jwt.getAppUserId();
        AppUser user = userRepository.findByIdOptional(callerId)
                .orElseThrow(() -> ResourceNotFoundException.user(callerId));

        String email = request.getEmail().trim().toLowerCase();
        if (email.endsWith("@local")) {
            throw new BusinessException("Please set a real email address, not a temporary @local address.");
        }

        // Orphan login (Clerk-linked @local) saving the Team invite email → merge onto invite
        // so assigned tasks become visible under this Clerk session.
        Optional<AppUser> emailOwner = userRepository.findByEmail(email);
        if (emailOwner.isPresent() && !emailOwner.get().getId().equals(callerId)) {
            AppUser invite = emailOwner.get();
            if (canClaimInvite(user, invite)) {
                user = mergeOrphanIntoInvite(user, invite);
                currentAppUser.set(user);
                log.info("Profile save merged orphan into invite id={} ({})", user.getId(), email);
            } else {
                throw new BusinessException("A user with email '" + email + "' already exists");
            }
        }

        Long me = user.getId();
        String before = summary(user);
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(email);
        currentAppUser.set(user);

        activityEvents.fire(TaskActivityEvent.userUpdated(
                me, me, before, summary(user)));

        log.info("Updated own profile id={} ({})", me, email);
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

        String snapshot = summary(user);
        userRepository.delete(user);
        activityEvents.fire(TaskActivityEvent.userDeleted(callerId, id, snapshot));
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

        String resolvedEmail = resolveEmail();

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

        // Race-safe: another request may have provisioned between our lookup and insert
        return createFromJwt(clerkId, resolvedEmail, profile);
    }

    /**
     * Email used for invite linking / provisioning. Client-supplied
     * {@link SyncUserRequest#getEmail()} is ignored — trusting it allowed
     * account takeover of unlinked Team invites.
     *
     * @throws AccessDeniedException if the JWT has no verified, non-synthetic email
     */
    private String resolveEmail() {
        String fromJwt = jwt.findClaimEmail();
        if (fromJwt != null && !isSyntheticEmail(fromJwt)) {
            return fromJwt;
        }
        throw new AccessDeniedException(
                "Authenticated token is missing a verified email claim. "
                + "Cannot provision or link a local account without a JWT email.");
    }

    /**
     * Caller already linked by clerk_id. If they were auto-provisioned as {@code sub@local}
     * and a Team invite exists for their real email, merge onto the invite (keeps task FKs).
     */
    private AppUser finalizeLinkedUser(AppUser existing, String resolvedEmail, SyncUserRequest profile) {
        if (resolvedEmail != null) {
            Optional<AppUser> invite = userRepository.findByEmail(resolvedEmail);
            if (invite.isPresent() && !invite.get().getId().equals(existing.getId())
                    && canClaimInvite(existing, invite.get())) {
                AppUser merged = mergeOrphanIntoInvite(existing, invite.get());
                enrichFromProfile(merged, profile);
                return syncRoleFromToken(merged);
            }
            // No claimable invite — upgrade synthetic orphan email when free
            if (isSyntheticEmail(existing.getEmail())
                    && !resolvedEmail.equalsIgnoreCase(existing.getEmail())
                    && invite.isEmpty()) {
                existing.setEmail(resolvedEmail);
            }
        }

        enrichFromProfile(existing, profile);
        return syncRoleFromToken(existing);
    }

    /**
     * True when {@code claimant} (Clerk-linked session user) may absorb {@code invite}
     * (Team row that owns the email / task FKs).
     */
    private boolean canClaimInvite(AppUser claimant, AppUser invite) {
        if (claimant == null || invite == null || claimant.getId().equals(invite.getId())) {
            return false;
        }
        if (claimant.getClerkId() == null || claimant.getClerkId().isBlank()) {
            return false;
        }
        String inviteClerk = invite.getClerkId();
        if (inviteClerk != null && !inviteClerk.isBlank()
                && !inviteClerk.equals(claimant.getClerkId())
                && !inviteClerk.contains(":merged:")) {
            return false;
        }
        if (isSyntheticEmail(claimant.getEmail())) {
            return true;
        }
        // Non-synthetic claimant with no task history can still consolidate onto the invite email
        return taskRepository.countByUserInvolved(claimant.getId()) == 0;
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
     * Uses a temporary clerk_id on the orphan so the real subject is never left unassigned
     * (avoids a race where another request auto-provisions a second row).
     */
    private AppUser mergeOrphanIntoInvite(AppUser orphan, AppUser invite) {
        // Move any task refs the orphan acquired before merge (keeps invite as the surviving id)
        taskRepository.reassignUserReferences(orphan.getId(), invite.getId());

        String clerkId = orphan.getClerkId();
        // Park the subject under a unique temporary value — never leave clerk_id NULL mid-merge
        orphan.setClerkId(clerkId + ":merged:" + orphan.getId());
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
        // Re-check after the empty lookup — concurrent request may have inserted already
        Optional<AppUser> raced = userRepository.findByClerkId(clerkId);
        if (raced.isPresent()) {
            return finalizeLinkedUser(raced.get(), resolvedEmail, profile);
        }

        String email = resolvedEmail != null ? resolvedEmail : (clerkId + "@local");
        // If synthetic email collides, uniquify — real email path should have linked above
        if (userRepository.findByEmail(email).isPresent()) {
            email = clerkId + "@local";
        }

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
        try {
            userRepository.persist(user);
            userRepository.flush();
        } catch (Exception e) {
            // Unique clerk_id / email race — load the winner and continue
            Optional<AppUser> existing = userRepository.findByClerkId(clerkId);
            if (existing.isPresent()) {
                log.warn("Provisioning race for Clerk subject {} — using existing id={}",
                        clerkId, existing.get().getId());
                return finalizeLinkedUser(existing.get(), resolvedEmail, profile);
            }
            if (resolvedEmail != null) {
                Optional<AppUser> byEmail = userRepository.findByEmail(resolvedEmail);
                if (byEmail.isPresent()) {
                    return linkInvite(byEmail.get(), clerkId, profile);
                }
            }
            throw e;
        }
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

    private static String summary(AppUser user) {
        return user.getEmail() + " [" + user.getRole() + "] "
                + user.getFirstName() + " " + user.getLastName();
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
     * Database role is the source of truth after initial provisioning.
     * JWT / Clerk metadata must not silently promote or demote the caller.
     */
    private AppUser syncRoleFromToken(AppUser existing) {
        return existing;
    }
}
