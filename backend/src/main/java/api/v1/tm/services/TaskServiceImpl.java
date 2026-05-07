package api.v1.tm.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.ResponseArray;
import api.v1.tm.entity.Task;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.utils.ResponseManager;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;
    private final ResponseManager responseManager;
    private final JsonWebToken jwt;

    @Override
    @Transactional
    public Uni<ResponseArray<?>> createTask(TaskRequest request) {
        String userRole = getRoleFromJwt();
        if (!"supervisor".equals(userRole) && !"admin".equals(userRole)) {
            return responseManager.onHandleErrorResponse("Only supervisors and admins can create tasks");
        }

        LocalDateTime now = LocalDateTime.now();
        String supervisorId = jwt.getSubject();

        boolean hasAssignee = request.getAssignedTo() != null && !request.getAssignedTo().isBlank();
        String initialStatus = hasAssignee ? "assigned" : "created";

        Task task = Task.builder()
                .taskTitle(request.getTaskTitle())
                .taskDescription(request.getTaskDescription())
                .status(initialStatus)
                .assignedTo(request.getAssignedTo())
                .assignedBy(supervisorId != null ? supervisorId : "unknown")
                .attachedFile(null)
                .createdAt(now)
                .updatedAt(now)
                .build();
        taskRepository.persist(task);
        log.info("Task '{}' created with status '{}'", task.getTaskTitle(), initialStatus);
        return responseManager.onHandleSuccessResponse(task);
    }

    @Override
    @Transactional
    public Uni<ResponseArray<?>> assignTask(AssignTaskRequest request) {
        String userRole = getRoleFromJwt();
        if (!"supervisor".equals(userRole) && !"admin".equals(userRole)) {
            return responseManager.onHandleErrorResponse("Only supervisors and admins can assign tasks");
        }

        Optional<Task> taskOpt = taskRepository.findByIdOptional(request.getTaskId());
        if (taskOpt.isEmpty()) {
            return responseManager.onHandleErrorResponse("Task not found");
        }
        Task task = taskOpt.get();
        if (!"created".equals(task.getStatus()) && !"assigned".equals(task.getStatus())) {
            return responseManager.onHandleErrorResponse(
                "Can only assign tasks with status 'created' or 'assigned'. Current status: " + task.getStatus());
        }
        task.setAssignedTo(request.getAssignedTo());
        task.setStatus("assigned");
        task.setUpdatedAt(LocalDateTime.now());
        log.info("Task {} assigned/re-assigned to {}", request.getTaskId(), request.getAssignedTo());
        return responseManager.onHandleSuccessResponse(task);
    }

    @Override
    @Transactional
    public Uni<ResponseArray<?>> getAllTasks() {
        String userRole = getRoleFromJwt();
        String userId = jwt.getSubject();
        List<Task> tasks;
        if ("supervisor".equals(userRole) || "admin".equals(userRole)) {
            tasks = taskRepository.listAll();
        } else {
            tasks = taskRepository.list("assignedTo", userId);
        }
        log.info("Fetched {} tasks for role '{}'", tasks.size(), userRole);
        return responseManager.onHandleSuccessResponse(tasks);
    }

    @Override
    @Transactional
    public Uni<ResponseArray<?>> getTaskById(Long taskId) {
        String userRole = getRoleFromJwt();
        String userId = jwt.getSubject();
        Optional<Task> taskOpt = taskRepository.findByIdOptional(taskId);
        if (taskOpt.isEmpty()) {
            return responseManager.onHandleErrorResponse("Task not found");
        }
        Task task = taskOpt.get();
        if ("employee".equals(userRole) && !userId.equals(task.getAssignedTo())) {
            return responseManager.onHandleErrorResponse("You do not have access to this task");
        }
        return responseManager.onHandleSuccessResponse(task);
    }

    @Override
    @Transactional
    public Uni<ResponseArray<?>> updateTaskStatus(Long taskId, String newStatus) {
        String userRole = getRoleFromJwt();
        String userId = jwt.getSubject();

        Optional<Task> taskOpt = taskRepository.findByIdOptional(taskId);
        if (taskOpt.isEmpty()) {
            return responseManager.onHandleErrorResponse("Task not found");
        }
        Task task = taskOpt.get();
        String currentStatus = task.getStatus();

        if ("employee".equals(userRole) && !userId.equals(task.getAssignedTo())) {
            return responseManager.onHandleErrorResponse("You can only update tasks assigned to you");
        }

        boolean valid = switch (userRole) {
            case "employee" -> isValidEmployeeTransition(currentStatus, newStatus);
            case "supervisor", "admin" -> isValidSupervisorTransition(currentStatus, newStatus);
            default -> false;
        };

        if (!valid) {
            return responseManager.onHandleErrorResponse(
                "Cannot change status from '" + currentStatus + "' to '" + newStatus + "' for role '" + userRole + "'");
        }

        task.setStatus(newStatus);
        task.setUpdatedAt(LocalDateTime.now());
        log.info("Task {} status updated: {} → {}", taskId, currentStatus, newStatus);
        return responseManager.onHandleSuccessResponse(task);
    }

    @Override
    @Transactional
    public Uni<ResponseArray<?>> uploadFile(Long taskId, FileUpload file) {
        String userRole = getRoleFromJwt();
        if (!"supervisor".equals(userRole) && !"admin".equals(userRole)) {
            return responseManager.onHandleErrorResponse("Only supervisors and admins can upload files");
        }

        Optional<Task> taskOpt = taskRepository.findByIdOptional(taskId);
        if (taskOpt.isEmpty()) {
            return responseManager.onHandleErrorResponse("Task not found");
        }
        try {
            String uploadDir = System.getProperty("user.home") + "/task-uploads";
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            String savedName = taskId + "_" + System.currentTimeMillis() + "_" + file.fileName();
            Path target = uploadPath.resolve(savedName);
            Files.copy(file.uploadedFile(), target, StandardCopyOption.REPLACE_EXISTING);

            Task task = taskOpt.get();
            task.setAttachedFile(savedName);
            task.setUpdatedAt(LocalDateTime.now());
            log.info("File '{}' uploaded for task {}", savedName, taskId);
            return responseManager.onHandleSuccessResponse(task);
        } catch (IOException e) {
            log.error("File upload failed for task {}", taskId, e);
            return responseManager.onHandleErrorResponse("File upload failed: " + e.getMessage());
        }
    }

    private boolean isValidEmployeeTransition(String from, String to) {
        return ("assigned".equals(from) && "in_progress".equals(to))
            || ("in_progress".equals(from) && "resolved".equals(to));
    }

    private boolean isValidSupervisorTransition(String from, String to) {
        return ("resolved".equals(from) && "done".equals(to))
            || ("created".equals(from) && "assigned".equals(to));
    }

    private String getRoleFromJwt() {
        Object meta = jwt.getClaim("user_metadata");
        if (meta instanceof JsonObject jo) {
            JsonString role = jo.getJsonString("role");
            if (role != null && !role.getString().isBlank()) {
                return role.getString().trim().toLowerCase();
            }
        }
        log.warn("Could not extract role from user_metadata; defaulting to 'employee'");
        return "employee";
    }
}
