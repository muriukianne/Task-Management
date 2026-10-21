package api.v1.tm.services;

import api.v1.tm.activity.TaskActivityEvent;
import api.v1.tm.dtos.responses.ActivityLogResponse;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.entity.Task;
import api.v1.tm.entity.TaskActivityLog;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.repository.TaskActivityLogRepository;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.repository.UserRepository;
import api.v1.tm.utils.JwtHelper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class TaskActivityServiceImpl implements TaskActivityService {

    private final TaskActivityLogRepository activityRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final JwtHelper jwt;

    @Override
    @Transactional
    public TaskActivityLog record(TaskActivityEvent event) {
        if (event.actorId() == null || event.actionType() == null) {
            throw new IllegalArgumentException("actorId and actionType are required");
        }

        TaskActivityLog row = TaskActivityLog.builder()
                .taskId(event.taskId())
                .actorId(event.actorId())
                .actionType(event.actionType())
                .oldValue(event.oldValue())
                .newValue(event.newValue())
                .createdAt(LocalDateTime.now())
                .build();

        activityRepository.persist(row);
        log.debug("Activity logged: task={} action={} actor={}",
                row.getTaskId(), row.getActionType(), row.getActorId());
        return row;
    }

    @Override
    @Transactional
    public List<TaskActivityLog> listForTask(Long taskId) {
        assertCanViewTask(taskId);
        return activityRepository.findByTaskIdDesc(taskId);
    }

    @Override
    @Transactional
    public PagedResponse<ActivityLogResponse> listAll(
            int page, int size, Long actorId, String actionType, Long taskId) {
        jwt.requirePrivileged("view audit trail");

        var query = activityRepository.findAllFiltered(actorId, actionType, taskId);
        long total = query.count();
        List<TaskActivityLog> rows = query.page(page, size).list();

        Map<Long, AppUser> actors = loadUsers(rows.stream()
                .map(TaskActivityLog::getActorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<Long, Task> tasks = loadTasks(rows.stream()
                .map(TaskActivityLog::getTaskId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        List<ActivityLogResponse> content = rows.stream()
                .map(row -> toResponse(row, actors.get(row.getActorId()), tasks.get(row.getTaskId())))
                .toList();

        return PagedResponse.of(content, page, size, total);
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

    private Map<Long, Task> loadTasks(Set<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Task> map = new HashMap<>();
        for (Task task : taskRepository.list("taskId in ?1", ids)) {
            map.put(task.getTaskId(), task);
        }
        return map;
    }

    private static ActivityLogResponse toResponse(TaskActivityLog row, AppUser actor, Task task) {
        String actorName = null;
        String actorEmail = null;
        String actorRole = null;
        if (actor != null) {
            actorName = ((actor.getFirstName() != null ? actor.getFirstName() : "")
                    + " "
                    + (actor.getLastName() != null ? actor.getLastName() : "")).trim();
            if (actorName.isBlank()) {
                actorName = actor.getEmail();
            }
            actorEmail = actor.getEmail();
            actorRole = actor.getRole();
        }

        return ActivityLogResponse.builder()
                .id(row.getId())
                .taskId(row.getTaskId())
                .taskTitle(task != null ? task.getTaskTitle() : null)
                .actorId(row.getActorId())
                .actorName(actorName)
                .actorEmail(actorEmail)
                .actorRole(actorRole)
                .actionType(row.getActionType())
                .oldValue(row.getOldValue())
                .newValue(row.getNewValue())
                .createdAt(row.getCreatedAt())
                .build();
    }

    private void assertCanViewTask(Long taskId) {
        if (jwt.isPrivileged()) {
            taskRepository.findByIdOptional(taskId)
                    .orElseThrow(() -> ResourceNotFoundException.task(taskId));
            return;
        }
        taskRepository.findByIdAndAssignee(taskId, jwt.getAppUserId())
                .orElseThrow(() -> new AccessDeniedException(
                        "Task not found or not assigned to you"));
    }
}
