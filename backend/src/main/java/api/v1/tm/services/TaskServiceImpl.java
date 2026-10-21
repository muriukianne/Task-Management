package api.v1.tm.services;

import api.v1.tm.activity.TaskActivityEvent;
import api.v1.tm.dtos.requests.AddDependencyRequest;
import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.CreateCommentRequest;
import api.v1.tm.dtos.requests.RejectTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.dtos.responses.TaskAssigneeResponse;
import api.v1.tm.dtos.responses.TaskCommentResponse;
import api.v1.tm.dtos.responses.TaskDependencyResponse;
import api.v1.tm.dtos.responses.TaskDocumentFile;
import api.v1.tm.dtos.responses.TaskDocumentResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.entity.Task;
import api.v1.tm.entity.TaskAssignee;
import api.v1.tm.entity.TaskComment;
import api.v1.tm.entity.TaskDependency;
import api.v1.tm.entity.TaskDocument;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.BusinessException;
import api.v1.tm.exception.ConflictException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.notification.NotificationType;
import api.v1.tm.repository.TaskAssigneeRepository;
import api.v1.tm.repository.TaskCommentRepository;
import api.v1.tm.repository.TaskDependencyRepository;
import api.v1.tm.repository.TaskDocumentRepository;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.utils.JwtHelper;
import io.quarkus.panache.common.Page;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024; // 10 MB

    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository assigneeRepository;
    private final TaskDependencyRepository dependencyRepository;
    private final TaskCommentRepository commentRepository;
    private final TaskDocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final JwtHelper jwt;
    private final Event<TaskActivityEvent> activityEvents;

    // ── Create ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> createTask(TaskRequest request) {
        jwt.requirePrivileged("create tasks");

        Long leadId = request.getAssignedTo();
        requireAssignableEmployee(leadId);
        List<Long> coIds = normalizeCoAssignees(request.getCoAssignees(), leadId);

        String priority = request.getPriority() != null
                ? request.getPriority().trim().toLowerCase() : "medium";
        LocalDateTime now = LocalDateTime.now();

        Task task = Task.builder()
                .taskTitle(request.getTaskTitle().trim())
                .taskDescription(request.getTaskDescription().trim())
                .status("assigned")
                .priority(priority)
                .dueDate(request.getDueDate())
                .assignedTo(leadId)
                .assignedBy(jwt.getAppUserId())
                .createdAt(now)
                .updatedAt(now)
                .build();

        taskRepository.persist(task);
        taskRepository.flush();

        replaceAssignees(task.getTaskId(), leadId, coIds, now);
        addDependenciesOnCreate(task.getTaskId(), request.getDependsOnTaskIds());

        activityEvents.fire(TaskActivityEvent.taskCreated(
                task.getTaskId(), jwt.getAppUserId(), task.getTaskTitle()));
        activityEvents.fire(TaskActivityEvent.assigneeChanged(
                task.getTaskId(), jwt.getAppUserId(), null, leadId));

        Long actorId = jwt.getAppUserId();
        notifyAssignees(task, actorId, NotificationType.TASK_CREATED,
                "New task assigned",
                "\"" + task.getTaskTitle() + "\" was assigned to you.");

        log.info("Task '{}' created [status={}, priority={}, coAssignees={}] by appUserId={}",
                task.getTaskTitle(), task.getStatus(), priority, coIds.size(), jwt.getAppUserId());
        return Uni.createFrom().item(enrich(task));
    }

    // ── Assign ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> assignTask(AssignTaskRequest request) {
        jwt.requirePrivileged("assign tasks");

        Task task = findTaskOrThrow(request.getTaskId());

        if (!canReassignStatus(task.getStatus())) {
            throw new BusinessException(
                    "Cannot assign a task in status '" + task.getStatus() +
                    "'. Only 'created', 'assigned', or 'resolved' (awaiting supervisor approval) tasks can be reassigned.");
        }

        Long leadId = request.getAssignedTo();
        requireAssignableEmployee(leadId);
        List<Long> coIds = normalizeCoAssignees(request.getCoAssignees(), leadId);

        Set<Long> previousMembers = assigneeUserIds(task.getTaskId());
        if (previousMembers.isEmpty() && task.getAssignedTo() != null) {
            previousMembers = Set.of(task.getAssignedTo());
        }
        Long previousLead = task.getAssignedTo();
        String previousStatus = task.getStatus();

        task.setAssignedTo(leadId);
        task.setStatus("assigned");
        task.setApprovalRequestedBy(null);
        task.setUpdatedAt(LocalDateTime.now());
        replaceAssignees(task.getTaskId(), leadId, coIds, LocalDateTime.now());

        Long actorId = jwt.getAppUserId();
        Set<Long> newMembers = new LinkedHashSet<>();
        newMembers.add(leadId);
        newMembers.addAll(coIds);

        Set<Long> added = new LinkedHashSet<>(newMembers);
        added.removeAll(previousMembers);
        Set<Long> removed = new LinkedHashSet<>(previousMembers);
        removed.removeAll(newMembers);

        if (!Objects.equals(previousLead, leadId) || !added.isEmpty() || !removed.isEmpty()) {
            activityEvents.fire(TaskActivityEvent.assigneeChanged(
                    task.getTaskId(), actorId, previousLead, leadId));
            for (Long userId : added) {
                notificationService.notify(
                        userId, actorId, task.getTaskId(),
                        NotificationType.ASSIGNEE_CHANGED,
                        "Task assigned to you",
                        "\"" + task.getTaskTitle() + "\" was assigned to you.");
            }
            for (Long userId : removed) {
                notificationService.notify(
                        userId, actorId, task.getTaskId(),
                        NotificationType.ASSIGNEE_CHANGED,
                        "Removed from task",
                        "You were removed from \"" + task.getTaskTitle() + "\".");
            }
        }
        if (!"assigned".equals(previousStatus)) {
            activityEvents.fire(TaskActivityEvent.statusChanged(
                    task.getTaskId(), actorId, previousStatus, "assigned"));
        }

        log.info("Task {} reassigned lead={} coAssignees={} by appUserId={}",
                request.getTaskId(), leadId, coIds.size(), jwt.getAppUserId());
        return Uni.createFrom().item(enrich(task));
    }

    // ── Read all (paginated) ──────────────────────────────────────────────────

    @Override
    @Transactional
    public PagedResponse<Task> getAllTasks(int page, int size, String status, String priority) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);

        Long assignedToFilter = jwt.isPrivileged() ? null : jwt.getAppUserId();

        var query  = taskRepository.findWithFilters(assignedToFilter, status, priority);
        long total = query.count();
        List<Task> content = query.page(Page.of(safePage, safeSize)).list();
        content.forEach(this::enrich);

        log.info("Fetched {}/{} tasks [page={}, size={}, role={}]",
                content.size(), total, safePage, safeSize, jwt.getRole());
        return PagedResponse.of(content, safePage, safeSize, total);
    }

    // ── Read one ──────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Task getTaskById(Long taskId) {
        return enrich(findTaskForCaller(taskId));
    }

    // ── Update status ─────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> updateTaskStatus(Long taskId, String newStatus, Integer version) {
        Task task = findTaskForCaller(taskId);

        if (version == null || !version.equals(task.getVersion())) {
            throw ConflictException.staleTask(taskId);
        }

        String current = task.getStatus();
        String role    = jwt.getRole();
        String to      = newStatus != null ? newStatus.trim().toLowerCase() : "";
        Long actorId   = jwt.getAppUserId();

        boolean valid = switch (role) {
            case "employee"             -> isValidEmployeeTransition(current, to);
            case "supervisor", "admin"  -> isValidSupervisorTransition(current, to);
            default                     -> false;
        };

        if (!valid) {
            throw new BusinessException(String.format(
                    "Invalid transition: '%s' → '%s' is not allowed for role '%s'. " +
                    "Employee: assigned→in_progress; co-assignee submits pending_approval; " +
                    "lead resolves (or approves pending_approval). " +
                    "Supervisor/Admin: resolved→done (or reject), created→assigned.",
                    current, to, role));
        }

        if ("in_progress".equals(to) && "assigned".equals(current)) {
            assertDependenciesSatisfied(taskId);
        }

        // Lead / co-assignee collaboration rules (employees on multi-assignee tasks)
        if ("employee".equals(role)) {
            enforceAssigneeResolutionRules(task, actorId, current, to);
        }

        Long previousRequester = task.getApprovalRequestedBy();

        task.setStatus(to);
        task.setUpdatedAt(LocalDateTime.now());

        if ("pending_approval".equals(to)) {
            task.setApprovalRequestedBy(actorId);
        } else if ("resolved".equals(to) || ("in_progress".equals(to) && "pending_approval".equals(current))) {
            task.setApprovalRequestedBy(null);
        }

        activityEvents.fire(TaskActivityEvent.statusChanged(
                taskId, actorId, current, to));

        notifyStatusChange(task, actorId, current, to, previousRequester);

        log.info("Task {} status: {} → {} by appUserId={}", taskId, current, to, actorId);
        return Uni.createFrom().item(enrich(task));
    }

    // ── Reject (supervisor/admin) ─────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> rejectTask(Long taskId, RejectTaskRequest request) {
        jwt.requirePrivileged("reject tasks");

        Task task = findTaskOrThrow(taskId);
        String current = task.getStatus();
        if (!"resolved".equals(current)) {
            throw new BusinessException(
                    "Only resolved tasks can be rejected. Current status: '" + current + "'.");
        }

        String reason = request.getReason().trim();
        String rejectionBody = "Rejection: " + reason;

        task.setStatus("in_progress");
        task.setApprovalRequestedBy(null);
        task.setUpdatedAt(LocalDateTime.now());

        TaskComment comment = TaskComment.builder()
                .taskId(taskId)
                .authorId(jwt.getAppUserId())
                .body(rejectionBody)
                .createdAt(LocalDateTime.now())
                .build();
        commentRepository.persist(comment);

        activityEvents.fire(TaskActivityEvent.statusChanged(
                taskId, jwt.getAppUserId(), current, "in_progress"));
        activityEvents.fire(TaskActivityEvent.taskRejected(
                taskId, jwt.getAppUserId(), current, reason));
        activityEvents.fire(TaskActivityEvent.commentAdded(
                taskId, jwt.getAppUserId(), truncate(rejectionBody, 200)));

        Long actorId = jwt.getAppUserId();
        notifyAssignees(task, actorId, NotificationType.TASK_REJECTED,
                "Task rejected — needs rework",
                "\"" + task.getTaskTitle() + "\": " + reason);

        log.info("Task {} rejected (resolved→in_progress) by appUserId={}", taskId, actorId);
        return Uni.createFrom().item(enrich(task));
    }

    // ── Dependencies ──────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> addDependency(Long taskId, AddDependencyRequest request) {
        jwt.requirePrivileged("manage task dependencies");
        Task task = findTaskOrThrow(taskId);
        Long dependsOnId = request.getDependsOnTaskId();

        if (Objects.equals(taskId, dependsOnId)) {
            throw new BusinessException("A task cannot depend on itself.");
        }
        Task blocker = findTaskOrThrow(dependsOnId);

        if (dependencyRepository.findEdge(taskId, dependsOnId).isPresent()) {
            throw new BusinessException("That dependency already exists.");
        }
        if (wouldCreateCycle(taskId, dependsOnId)) {
            throw new BusinessException(
                    "Adding this dependency would create a cycle.");
        }

        dependencyRepository.persist(TaskDependency.builder()
                .taskId(taskId)
                .dependsOnTaskId(dependsOnId)
                .createdAt(LocalDateTime.now())
                .build());

        log.info("Dependency added: task {} depends on {} ({})",
                taskId, dependsOnId, blocker.getTaskTitle());
        return Uni.createFrom().item(enrich(task));
    }

    @Override
    @Transactional
    public Uni<Void> removeDependency(Long taskId, Long dependsOnTaskId) {
        jwt.requirePrivileged("manage task dependencies");
        findTaskOrThrow(taskId);
        if (dependencyRepository.findEdge(taskId, dependsOnTaskId).isEmpty()) {
            throw new ResourceNotFoundException("Dependency not found");
        }
        dependencyRepository.deleteEdge(taskId, dependsOnTaskId);
        log.info("Dependency removed: task {} no longer depends on {}", taskId, dependsOnTaskId);
        return Uni.createFrom().voidItem();
    }

    // ── Comments ──────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public List<TaskCommentResponse> listComments(Long taskId) {
        findTaskForCaller(taskId); // access check
        List<TaskComment> comments = commentRepository.findByTaskIdAsc(taskId);
        Map<Long, AppUser> authors = loadUsers(comments.stream()
                .map(TaskComment::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return comments.stream()
                .map(c -> toCommentResponse(c, authors.get(c.getAuthorId())))
                .toList();
    }

    @Override
    @Transactional
    public Uni<TaskCommentResponse> addComment(Long taskId, CreateCommentRequest request) {
        Task task = findTaskForCaller(taskId);

        String body = request.getBody().trim();
        Long actorId = jwt.getAppUserId();
        TaskComment comment = TaskComment.builder()
                .taskId(taskId)
                .authorId(actorId)
                .body(body)
                .createdAt(LocalDateTime.now())
                .build();
        commentRepository.persist(comment);
        commentRepository.flush();

        activityEvents.fire(TaskActivityEvent.commentAdded(
                taskId, actorId, truncate(body, 200)));

        // Notify collaborators (other assignees + assigner), excluding the actor
        notifyCollaboratorsExcept(task, actorId, NotificationType.COMMENT_ADDED,
                "New comment on \"" + task.getTaskTitle() + "\"",
                truncate(body, 280));

        AppUser author = userRepository.findByIdOptional(actorId).orElse(null);
        log.info("Comment {} added on task {} by appUserId={}",
                comment.getId(), taskId, actorId);
        return Uni.createFrom().item(toCommentResponse(comment, author));
    }

    // ── File upload ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> uploadFile(Long taskId, FileUpload file) {
        return uploadDocument(taskId, file).map(doc -> findTaskOrThrow(taskId));
    }

    @Override
    @Transactional
    public List<TaskDocumentResponse> listDocuments(Long taskId) {
        findTaskForCaller(taskId);
        List<TaskDocument> docs = documentRepository.findByTaskIdDesc(taskId);
        Map<Long, AppUser> uploaders = loadUsers(docs.stream()
                .map(TaskDocument::getUploadedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return docs.stream()
                .map(d -> toDocumentResponse(d, uploaders.get(d.getUploadedBy())))
                .toList();
    }

    @Override
    @Transactional
    public Uni<TaskDocumentResponse> uploadDocument(Long taskId, FileUpload file) {
        Task task = findTaskForCaller(taskId);
        validateUpload(file);

        try {
            Path uploadDir = uploadDirectory();
            if (!Files.exists(uploadDir)) Files.createDirectories(uploadDir);

            String safeOriginal = Paths.get(file.fileName()).getFileName().toString()
                    .replaceAll("[^a-zA-Z0-9._\\-]", "_");
            if (safeOriginal.isBlank()) {
                safeOriginal = "document";
            }
            String savedName = taskId + "_" + System.currentTimeMillis() + "_" + safeOriginal;

            Path target = uploadDir.resolve(savedName).normalize();
            if (!target.startsWith(uploadDir.normalize())) {
                throw new BusinessException("Invalid file name");
            }

            Files.copy(file.uploadedFile(), target, StandardCopyOption.REPLACE_EXISTING);

            Long actorId = jwt.getAppUserId();
            TaskDocument doc = TaskDocument.builder()
                    .taskId(taskId)
                    .uploadedBy(actorId)
                    .originalName(safeOriginal)
                    .storedName(savedName)
                    .contentType(file.contentType())
                    .sizeBytes(file.size())
                    .createdAt(LocalDateTime.now())
                    .build();
            documentRepository.persist(doc);
            documentRepository.flush();

            // Keep legacy single-file column in sync (kanban badge / older clients)
            String previousFile = task.getAttachedFile();
            task.setAttachedFile(savedName);
            task.setUpdatedAt(LocalDateTime.now());

            activityEvents.fire(TaskActivityEvent.fileUploaded(
                    taskId, actorId, previousFile, safeOriginal));

            notifyCollaboratorsExcept(task, actorId, NotificationType.FILE_UPLOADED,
                    "Document uploaded on \"" + task.getTaskTitle() + "\"",
                    safeOriginal);

            AppUser uploader = userRepository.findByIdOptional(actorId).orElse(null);
            log.info("Document '{}' uploaded for task {} by appUserId={}",
                    savedName, taskId, actorId);
            return Uni.createFrom().item(toDocumentResponse(doc, uploader));

        } catch (IOException e) {
            log.error("File upload IO error for task {}", taskId, e);
            throw new BusinessException("File upload failed: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public TaskDocumentFile downloadDocument(Long taskId, Long documentId) {
        findTaskForCaller(taskId);
        TaskDocument doc = documentRepository.findByIdAndTaskId(documentId, taskId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Document not found: " + documentId));

        Path path = uploadDirectory().resolve(doc.getStoredName()).normalize();
        if (!path.startsWith(uploadDirectory().normalize()) || !Files.exists(path)) {
            throw new ResourceNotFoundException("Stored file is missing for document " + documentId);
        }
        return new TaskDocumentFile(
                path,
                doc.getOriginalName(),
                doc.getContentType() != null ? doc.getContentType() : "application/octet-stream",
                doc.getSizeBytes() != null ? doc.getSizeBytes() : 0L);
    }

    @Override
    @Transactional
    public Uni<Void> deleteDocument(Long taskId, Long documentId) {
        Task task = findTaskForCaller(taskId);
        TaskDocument doc = documentRepository.findByIdAndTaskId(documentId, taskId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Document not found: " + documentId));

        // Uploader or privileged may delete
        Long actorId = jwt.getAppUserId();
        if (!jwt.isPrivileged() && !actorId.equals(doc.getUploadedBy())) {
            throw new AccessDeniedException("You can only delete documents you uploaded");
        }

        Path path = uploadDirectory().resolve(doc.getStoredName()).normalize();
        documentRepository.delete(doc);

        try {
            if (path.startsWith(uploadDirectory().normalize()) && Files.exists(path)) {
                Files.delete(path);
            }
        } catch (IOException e) {
            log.warn("Could not delete file on disk for document {}: {}", documentId, e.getMessage());
        }

        // Refresh legacy attachedFile to newest remaining doc (or null)
        List<TaskDocument> remaining = documentRepository.findByTaskIdDesc(taskId);
        task.setAttachedFile(remaining.isEmpty() ? null : remaining.get(0).getStoredName());
        task.setUpdatedAt(LocalDateTime.now());

        log.info("Document {} deleted from task {} by appUserId={}", documentId, taskId, actorId);
        return Uni.createFrom().voidItem();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Path uploadDirectory() {
        return Paths.get(System.getProperty("user.home"), "task-uploads");
    }

    private static TaskDocumentResponse toDocumentResponse(TaskDocument doc, AppUser uploader) {
        String uploaderName = null;
        String uploaderRole = null;
        if (uploader != null) {
            uploaderName = ((uploader.getFirstName() != null ? uploader.getFirstName() : "")
                    + " "
                    + (uploader.getLastName() != null ? uploader.getLastName() : "")).trim();
            if (uploaderName.isBlank()) uploaderName = uploader.getEmail();
            uploaderRole = uploader.getRole();
        }
        return TaskDocumentResponse.builder()
                .id(doc.getId())
                .taskId(doc.getTaskId())
                .uploadedBy(doc.getUploadedBy())
                .uploaderName(uploaderName)
                .uploaderRole(uploaderRole)
                .originalName(doc.getOriginalName())
                .contentType(doc.getContentType())
                .sizeBytes(doc.getSizeBytes())
                .createdAt(doc.getCreatedAt())
                .build();
    }

    private Task findTaskOrThrow(Long taskId) {
        return taskRepository.findByIdOptional(taskId)
                .orElseThrow(() -> ResourceNotFoundException.task(taskId));
    }

    private Task findTaskForCaller(Long taskId) {
        if (jwt.isPrivileged()) {
            return findTaskOrThrow(taskId);
        }
        return taskRepository.findByIdAndAssignee(taskId, jwt.getAppUserId())
                .orElseThrow(() -> new AccessDeniedException(
                        "Task not found or not assigned to you"));
    }

    private void requireAssignableEmployee(Long userId) {
        AppUser assignee = userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new BusinessException(
                        "Cannot assign: user id '" + userId + "' was not found. "
                        + "Create the employee under Team → New Account first."));
        if (!"employee".equalsIgnoreCase(assignee.getRole())) {
            throw new BusinessException(
                    "Cannot assign tasks to a " + assignee.getRole()
                    + ". Only employees can be assignees.");
        }
    }

    private void validateUpload(FileUpload file) {
        if (file.size() > MAX_FILE_BYTES) {
            throw new BusinessException("File exceeds the 10 MB size limit");
        }
        String ct = file.contentType();
        if (ct == null || !ALLOWED_MIME_TYPES.contains(ct.toLowerCase())) {
            throw new BusinessException(
                    "File type '" + ct + "' is not allowed. " +
                    "Accepted: images (JPEG/PNG/GIF/WebP), PDF, plain text, Word documents.");
        }
    }

    private boolean canReassignStatus(String status) {
        return "created".equals(status)
            || "assigned".equals(status)
            || "resolved".equals(status);
    }

    private boolean isValidEmployeeTransition(String from, String to) {
        return ("assigned".equals(from) && "in_progress".equals(to))
            || ("in_progress".equals(from) && "pending_approval".equals(to))
            || ("in_progress".equals(from) && "resolved".equals(to))
            || ("pending_approval".equals(from) && "resolved".equals(to))
            || ("pending_approval".equals(from) && "in_progress".equals(to));
    }

    private boolean isValidSupervisorTransition(String from, String to) {
        return ("resolved".equals(from) && "done".equals(to))
            || ("resolved".equals(from) && "in_progress".equals(to))
            || ("created".equals(from)  && "assigned".equals(to));
    }

    /**
     * Co-assignees must submit for lead approval; only the lead may mark resolved
     * (directly or by approving {@code pending_approval}). Solo lead tasks resolve normally.
     */
    private void enforceAssigneeResolutionRules(Task task, Long actorId, String from, String to) {
        boolean isLead = isTaskLead(task, actorId);
        boolean hasCoAssignees = hasCoAssignees(task.getTaskId(), task.getAssignedTo());

        if ("resolved".equals(to)) {
            if (!isLead) {
                throw new BusinessException(
                        "Only the team lead can mark this task as resolved. "
                        + "Submit for lead approval instead.");
            }
            return;
        }

        if ("pending_approval".equals(to)) {
            if (isLead) {
                throw new BusinessException(
                        "As team lead you can mark the task resolved directly — "
                        + "no approval step needed.");
            }
            if (!hasCoAssignees && !isAssigneeMember(task, actorId)) {
                throw new BusinessException("You are not an assignee on this task.");
            }
            return;
        }

        if ("in_progress".equals(to) && "pending_approval".equals(from)) {
            // Lead sends work back; co-assignee cannot cancel another way via this path alone
            if (!isLead) {
                throw new BusinessException(
                        "Only the team lead can send work back from pending approval.");
            }
        }
    }

    private boolean isTaskLead(Task task, Long userId) {
        if (userId == null) return false;
        if (userId.equals(task.getAssignedTo())) return true;
        return assigneeRepository.findByTaskAndUser(task.getTaskId(), userId)
                .map(a -> TaskAssignee.ROLE_LEAD.equals(a.getRole()))
                .orElse(false);
    }

    private boolean isAssigneeMember(Task task, Long userId) {
        if (userId == null) return false;
        if (userId.equals(task.getAssignedTo())) return true;
        return assigneeRepository.isAssignee(task.getTaskId(), userId);
    }

    private boolean hasCoAssignees(Long taskId, Long leadId) {
        return assigneeRepository.findByTaskId(taskId).stream()
                .anyMatch(a -> TaskAssignee.ROLE_CO.equals(a.getRole())
                        || (leadId != null && !leadId.equals(a.getUserId())));
    }

    private void notifyStatusChange(
            Task task, Long actorId, String from, String to, Long previousRequester) {
        String body = "\"" + task.getTaskTitle() + "\": " + from + " → " + to;

        if ("pending_approval".equals(to)) {
            Long leadId = task.getAssignedTo();
            if (leadId != null) {
                notificationService.notify(
                        leadId,
                        actorId,
                        task.getTaskId(),
                        NotificationType.LEAD_APPROVAL_PENDING,
                        "Approval needed: \"" + task.getTaskTitle() + "\"",
                        "A co-assignee submitted work for your approval before it can be resolved.");
            }
        } else if ("resolved".equals(to)) {
            notificationService.notify(
                    task.getAssignedBy(),
                    actorId,
                    task.getTaskId(),
                    NotificationType.STATUS_CHANGED,
                    "Task ready for review",
                    body);
            if (previousRequester != null && !previousRequester.equals(actorId)) {
                notificationService.notify(
                        previousRequester,
                        actorId,
                        task.getTaskId(),
                        NotificationType.STATUS_CHANGED,
                        "Lead approved your work",
                        "\"" + task.getTaskTitle() + "\" was approved and marked resolved.");
            }
        } else if ("done".equals(to)) {
            notifyAssignees(task, actorId, NotificationType.STATUS_CHANGED,
                    "Task confirmed done", body);
        } else if ("in_progress".equals(to) && "assigned".equals(from)) {
            notificationService.notify(
                    task.getAssignedBy(),
                    actorId,
                    task.getTaskId(),
                    NotificationType.STATUS_CHANGED,
                    "Work started on task",
                    body);
        } else if ("in_progress".equals(to) && "pending_approval".equals(from)) {
            if (previousRequester != null) {
                notificationService.notify(
                        previousRequester,
                        actorId,
                        task.getTaskId(),
                        NotificationType.STATUS_CHANGED,
                        "Lead sent work back",
                        "\"" + task.getTaskTitle() + "\" was returned to In Progress. Continue working.");
            }
        }
    }

    private List<Long> normalizeCoAssignees(List<Long> raw, Long leadId) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> unique = new LinkedHashSet<>();
        for (Long id : raw) {
            if (id == null || id.equals(leadId)) continue;
            requireAssignableEmployee(id);
            unique.add(id);
        }
        return new ArrayList<>(unique);
    }

    private void replaceAssignees(Long taskId, Long leadId, List<Long> coIds, LocalDateTime now) {
        assigneeRepository.deleteByTaskId(taskId);
        assigneeRepository.persist(TaskAssignee.builder()
                .taskId(taskId)
                .userId(leadId)
                .role(TaskAssignee.ROLE_LEAD)
                .createdAt(now)
                .build());
        for (Long coId : coIds) {
            assigneeRepository.persist(TaskAssignee.builder()
                    .taskId(taskId)
                    .userId(coId)
                    .role(TaskAssignee.ROLE_CO)
                    .createdAt(now)
                    .build());
        }
        assigneeRepository.flush();
    }

    private void addDependenciesOnCreate(Long taskId, List<Long> dependsOnIds) {
        if (dependsOnIds == null || dependsOnIds.isEmpty()) return;
        LinkedHashSet<Long> unique = new LinkedHashSet<>(dependsOnIds);
        for (Long dependsOnId : unique) {
            if (dependsOnId == null || dependsOnId.equals(taskId)) {
                throw new BusinessException("Invalid dependency task id.");
            }
            findTaskOrThrow(dependsOnId);
            if (wouldCreateCycle(taskId, dependsOnId)) {
                throw new BusinessException(
                        "Dependency on task " + dependsOnId + " would create a cycle.");
            }
            dependencyRepository.persist(TaskDependency.builder()
                    .taskId(taskId)
                    .dependsOnTaskId(dependsOnId)
                    .createdAt(LocalDateTime.now())
                    .build());
        }
    }

    private Set<Long> assigneeUserIds(Long taskId) {
        return assigneeRepository.findByTaskId(taskId).stream()
                .map(TaskAssignee::getUserId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void notifyAssignees(Task task, Long actorId, String type, String title, String body) {
        Set<Long> recipients = assigneeUserIds(task.getTaskId());
        if (recipients.isEmpty() && task.getAssignedTo() != null) {
            recipients = Set.of(task.getAssignedTo());
        }
        for (Long userId : recipients) {
            notificationService.notify(userId, actorId, task.getTaskId(), type, title, body);
        }
    }

    private void notifyCollaboratorsExcept(
            Task task, Long actorId, String type, String title, String body) {
        Set<Long> recipients = new LinkedHashSet<>(assigneeUserIds(task.getTaskId()));
        if (task.getAssignedTo() != null) recipients.add(task.getAssignedTo());
        if (task.getAssignedBy() != null) recipients.add(task.getAssignedBy());
        recipients.remove(actorId);
        for (Long userId : recipients) {
            notificationService.notify(userId, actorId, task.getTaskId(), type, title, body);
        }
    }

    private void assertDependenciesSatisfied(Long taskId) {
        List<TaskDependency> deps = dependencyRepository.findByTaskId(taskId);
        List<String> blocking = new ArrayList<>();
        for (TaskDependency dep : deps) {
            Task blocker = findTaskOrThrow(dep.getDependsOnTaskId());
            if (!isDependencySatisfied(blocker.getStatus())) {
                blocking.add("#" + blocker.getTaskId() + " \"" + blocker.getTaskTitle()
                        + "\" (" + blocker.getStatus() + ")");
            }
        }
        if (!blocking.isEmpty()) {
            throw new BusinessException(
                    "Cannot start work — blocked by unfinished dependencies: "
                    + String.join("; ", blocking));
        }
    }

    private static boolean isDependencySatisfied(String status) {
        return "resolved".equals(status) || "done".equals(status);
    }

    /**
     * True if adding edge (taskId → dependsOnId) would create a cycle
     * (i.e. dependsOnId can already reach taskId through existing edges).
     */
    private boolean wouldCreateCycle(Long taskId, Long dependsOnId) {
        Set<Long> visited = new HashSet<>();
        return canReach(dependsOnId, taskId, visited);
    }

    private boolean canReach(Long fromTaskId, Long targetTaskId, Set<Long> visited) {
        if (Objects.equals(fromTaskId, targetTaskId)) return true;
        if (!visited.add(fromTaskId)) return false;
        for (TaskDependency dep : dependencyRepository.findByTaskId(fromTaskId)) {
            if (canReach(dep.getDependsOnTaskId(), targetTaskId, visited)) {
                return true;
            }
        }
        return false;
    }

    private Task enrich(Task task) {
        if (task == null) return null;

        List<TaskAssignee> rows = assigneeRepository.findByTaskId(task.getTaskId());
        // Legacy tasks may lack junction rows until next assign — synthesize lead
        if (rows.isEmpty() && task.getAssignedTo() != null) {
            rows = List.of(TaskAssignee.builder()
                    .taskId(task.getTaskId())
                    .userId(task.getAssignedTo())
                    .role(TaskAssignee.ROLE_LEAD)
                    .createdAt(task.getCreatedAt())
                    .build());
        }

        Set<Long> userIds = rows.stream().map(TaskAssignee::getUserId).collect(Collectors.toSet());
        Map<Long, AppUser> users = loadUsers(userIds);

        List<TaskAssigneeResponse> assignees = new ArrayList<>();
        for (TaskAssignee row : rows) {
            AppUser u = users.get(row.getUserId());
            assignees.add(TaskAssigneeResponse.builder()
                    .userId(row.getUserId())
                    .role(row.getRole())
                    .firstName(u != null ? u.getFirstName() : null)
                    .lastName(u != null ? u.getLastName() : null)
                    .email(u != null ? u.getEmail() : null)
                    .build());
        }
        // Lead first
        assignees.sort((a, b) -> {
            if (TaskAssignee.ROLE_LEAD.equals(a.getRole())) return -1;
            if (TaskAssignee.ROLE_LEAD.equals(b.getRole())) return 1;
            return 0;
        });
        task.setAssignees(assignees);

        // Viewer role for the current caller (if provisioned)
        try {
            Long viewerId = jwt.getAppUserId();
            String viewerRole = null;
            for (TaskAssigneeResponse a : assignees) {
                if (a.getUserId().equals(viewerId)) {
                    viewerRole = a.getRole();
                    break;
                }
            }
            if (viewerRole == null && viewerId.equals(task.getAssignedTo())) {
                viewerRole = TaskAssignee.ROLE_LEAD;
            }
            task.setViewerAssigneeRole(viewerRole);
        } catch (Exception ignored) {
            task.setViewerAssigneeRole(null);
        }

        List<TaskDependencyResponse> deps = new ArrayList<>();
        boolean blocked = false;
        for (TaskDependency edge : dependencyRepository.findByTaskId(task.getTaskId())) {
            Task blocker = taskRepository.findByIdOptional(edge.getDependsOnTaskId()).orElse(null);
            if (blocker == null) continue;
            boolean satisfied = isDependencySatisfied(blocker.getStatus());
            if (!satisfied) blocked = true;
            deps.add(TaskDependencyResponse.builder()
                    .taskId(blocker.getTaskId())
                    .taskTitle(blocker.getTaskTitle())
                    .status(blocker.getStatus())
                    .satisfied(satisfied)
                    .build());
        }
        task.setDependencies(deps);
        task.setBlocked(blocked && !"done".equals(task.getStatus()));

        List<TaskDependencyResponse> dependents = new ArrayList<>();
        for (TaskDependency edge : dependencyRepository.findByDependsOnTaskId(task.getTaskId())) {
            Task dependent = taskRepository.findByIdOptional(edge.getTaskId()).orElse(null);
            if (dependent == null) continue;
            dependents.add(TaskDependencyResponse.builder()
                    .taskId(dependent.getTaskId())
                    .taskTitle(dependent.getTaskTitle())
                    .status(dependent.getStatus())
                    .satisfied(isDependencySatisfied(task.getStatus()))
                    .build());
        }
        task.setDependents(dependents);
        return task;
    }

    private Map<Long, AppUser> loadUsers(Set<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, AppUser> map = new HashMap<>();
        for (AppUser user : userRepository.list("id in ?1", ids)) {
            map.put(user.getId(), user);
        }
        return map;
    }

    private static TaskCommentResponse toCommentResponse(TaskComment comment, AppUser author) {
        String authorName = null;
        String authorEmail = null;
        String authorRole = null;
        if (author != null) {
            authorName = ((author.getFirstName() != null ? author.getFirstName() : "")
                    + " "
                    + (author.getLastName() != null ? author.getLastName() : "")).trim();
            if (authorName.isBlank()) {
                authorName = author.getEmail();
            }
            authorEmail = author.getEmail();
            authorRole = author.getRole();
        }
        return TaskCommentResponse.builder()
                .id(comment.getId())
                .taskId(comment.getTaskId())
                .authorId(comment.getAuthorId())
                .authorName(authorName)
                .authorEmail(authorEmail)
                .authorRole(authorRole)
                .body(comment.getBody())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "…";
    }
}
