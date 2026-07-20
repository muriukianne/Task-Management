package api.v1.tm.services;

import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.entity.Task;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.BusinessException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.utils.JwtHelper;
import io.quarkus.panache.common.Page;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
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
import java.util.List;
import java.util.Set;

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
    private final UserRepository userRepository;
    private final JwtHelper jwt;

    // ── Create ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> createTask(TaskRequest request) {
        jwt.requirePrivileged("create tasks");

        Long assignedTo = request.getAssignedTo();
        requireAssignableEmployee(assignedTo);

        String priority = request.getPriority() != null
                ? request.getPriority().trim().toLowerCase() : "medium";
        LocalDateTime now = LocalDateTime.now();

        Task task = Task.builder()
                .taskTitle(request.getTaskTitle().trim())
                .taskDescription(request.getTaskDescription().trim())
                .status("assigned")
                .priority(priority)
                .dueDate(request.getDueDate())
                .assignedTo(assignedTo)
                .assignedBy(jwt.getAppUserId())
                .createdAt(now)
                .updatedAt(now)
                .build();

        taskRepository.persist(task);
        log.info("Task '{}' created [status={}, priority={}] by appUserId={}",
                task.getTaskTitle(), task.getStatus(), priority, jwt.getAppUserId());
        return Uni.createFrom().item(task);
    }

    // ── Assign ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> assignTask(AssignTaskRequest request) {
        jwt.requirePrivileged("assign tasks");

        Task task = findTaskOrThrow(request.getTaskId());

        if (!"created".equals(task.getStatus()) && !"assigned".equals(task.getStatus())) {
            throw new BusinessException(
                    "Cannot assign a task in status '" + task.getStatus() +
                    "'. Only 'created' or 'assigned' tasks can be reassigned.");
        }

        Long assignedTo = request.getAssignedTo();
        requireAssignableEmployee(assignedTo);

        task.setAssignedTo(assignedTo);
        task.setStatus("assigned");
        task.setUpdatedAt(LocalDateTime.now());
        log.info("Task {} reassigned to appUserId={} by appUserId={}",
                request.getTaskId(), assignedTo, jwt.getAppUserId());
        return Uni.createFrom().item(task);
    }

    // ── Read all (paginated) ──────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<PagedResponse<Task>> getAllTasks(int page, int size, String status, String priority) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);

        // Employees only see tasks assigned to them; supervisors/admins see everything
        Long assignedToFilter = jwt.isPrivileged() ? null : jwt.getAppUserId();

        var query  = taskRepository.findWithFilters(assignedToFilter, status, priority);
        long total = query.count();
        List<Task> content = query.page(Page.of(safePage, safeSize)).list();

        log.info("Fetched {}/{} tasks [page={}, size={}, role={}]",
                content.size(), total, safePage, safeSize, jwt.getRole());
        return Uni.createFrom().item(PagedResponse.of(content, safePage, safeSize, total));
    }

    // ── Read one ──────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> getTaskById(Long taskId) {
        return Uni.createFrom().item(findTaskForCaller(taskId));
    }

    // ── Update status ─────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> updateTaskStatus(Long taskId, String newStatus) {
        Task task = findTaskForCaller(taskId);

        String current = task.getStatus();
        String role    = jwt.getRole();
        String to      = newStatus != null ? newStatus.trim().toLowerCase() : "";

        boolean valid = switch (role) {
            case "employee"             -> isValidEmployeeTransition(current, to);
            case "supervisor", "admin"  -> isValidSupervisorTransition(current, to);
            default                     -> false;
        };

        if (!valid) {
            throw new BusinessException(String.format(
                    "Invalid transition: '%s' → '%s' is not allowed for role '%s'. " +
                    "Employee: assigned→in_progress→resolved. " +
                    "Supervisor/Admin: resolved→done, created→assigned.",
                    current, to, role));
        }

        task.setStatus(to);
        task.setUpdatedAt(LocalDateTime.now());
        log.info("Task {} status: {} → {} by appUserId={}", taskId, current, to, jwt.getAppUserId());
        return Uni.createFrom().item(task);
    }

    // ── File upload ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Uni<Task> uploadFile(Long taskId, FileUpload file) {
        jwt.requirePrivileged("upload files");

        Task task = findTaskOrThrow(taskId);
        validateUpload(file);

        try {
            Path uploadDir = Paths.get(System.getProperty("user.home"), "task-uploads");
            if (!Files.exists(uploadDir)) Files.createDirectories(uploadDir);

            String safeOriginal = Paths.get(file.fileName()).getFileName().toString()
                    .replaceAll("[^a-zA-Z0-9._\\-]", "_");
            String savedName = taskId + "_" + System.currentTimeMillis() + "_" + safeOriginal;

            Path target = uploadDir.resolve(savedName).normalize();
            if (!target.startsWith(uploadDir.normalize())) {
                throw new BusinessException("Invalid file name");
            }

            Files.copy(file.uploadedFile(), target, StandardCopyOption.REPLACE_EXISTING);
            task.setAttachedFile(savedName);
            task.setUpdatedAt(LocalDateTime.now());
            log.info("File '{}' uploaded for task {} by appUserId={}",
                    savedName, taskId, jwt.getAppUserId());
            return Uni.createFrom().item(task);

        } catch (IOException e) {
            log.error("File upload IO error for task {}", taskId, e);
            throw new BusinessException("File upload failed: " + e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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

    private boolean isValidEmployeeTransition(String from, String to) {
        return ("assigned".equals(from)    && "in_progress".equals(to))
            || ("in_progress".equals(from) && "resolved".equals(to));
    }

    private boolean isValidSupervisorTransition(String from, String to) {
        return ("resolved".equals(from) && "done".equals(to))
            || ("created".equals(from)  && "assigned".equals(to));
    }
}
