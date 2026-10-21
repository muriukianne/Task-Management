package api.v1.tm.services;

import api.v1.tm.dtos.responses.NotificationResponse;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.entity.AppUser;
import api.v1.tm.entity.Notification;
import api.v1.tm.entity.Task;
import api.v1.tm.exception.AccessDeniedException;
import api.v1.tm.exception.ResourceNotFoundException;
import api.v1.tm.repository.NotificationRepository;
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
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final JwtHelper jwt;

    @Override
    @Transactional
    public void notify(Long recipientId, Long actorId, Long taskId, String type, String title, String body) {
        if (recipientId == null) {
            return;
        }
        if (actorId != null && actorId.equals(recipientId)) {
            return; // never notify yourself
        }

        Notification row = Notification.builder()
                .recipientId(recipientId)
                .actorId(actorId)
                .taskId(taskId)
                .type(type)
                .title(truncate(title, 200))
                .body(body)
                .createdAt(LocalDateTime.now())
                .build();
        notificationRepository.persist(row);
        log.debug("Notification {} → recipient={} type={}", row.getId(), recipientId, type);
    }

    @Override
    @Transactional
    public void notifyOncePerDay(Long recipientId, Long actorId, Long taskId, String type, String title, String body) {
        if (recipientId == null || taskId == null || type == null) {
            return;
        }
        if (notificationRepository.existsToday(recipientId, taskId, type)) {
            return;
        }
        notify(recipientId, actorId, taskId, type, title, body);
    }

    @Override
    @Transactional
    public PagedResponse<NotificationResponse> listMine(int page, int size, boolean unreadOnly) {
        Long me = jwt.getAppUserId();
        var query = notificationRepository.findForRecipient(me, unreadOnly);
        long total = query.count();
        List<Notification> rows = query.page(page, size).list();

        Map<Long, AppUser> actors = loadUsers(rows.stream()
                .map(Notification::getActorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<Long, Task> tasks = loadTasks(rows.stream()
                .map(Notification::getTaskId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        List<NotificationResponse> content = rows.stream()
                .map(n -> toResponse(n, actors.get(n.getActorId()), tasks.get(n.getTaskId())))
                .toList();
        return PagedResponse.of(content, page, size, total);
    }

    @Override
    @Transactional
    public long unreadCount() {
        return notificationRepository.countUnread(jwt.getAppUserId());
    }

    @Override
    @Transactional
    public NotificationResponse markRead(Long notificationId) {
        Long me = jwt.getAppUserId();
        Notification row = notificationRepository.findByIdOptional(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (!me.equals(row.getRecipientId())) {
            throw new AccessDeniedException("You can only mark your own notifications as read");
        }
        if (row.getReadAt() == null) {
            row.setReadAt(LocalDateTime.now());
        }
        AppUser actor = row.getActorId() != null
                ? userRepository.findByIdOptional(row.getActorId()).orElse(null)
                : null;
        Task task = row.getTaskId() != null
                ? taskRepository.findByIdOptional(row.getTaskId()).orElse(null)
                : null;
        return toResponse(row, actor, task);
    }

    @Override
    @Transactional
    public int markAllRead() {
        Long me = jwt.getAppUserId();
        List<Notification> unread = notificationRepository
                .find("recipientId = ?1 and readAt is null", me)
                .list();
        LocalDateTime now = LocalDateTime.now();
        for (Notification n : unread) {
            n.setReadAt(now);
        }
        return unread.size();
    }

    private Map<Long, AppUser> loadUsers(Set<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        Map<Long, AppUser> map = new HashMap<>();
        for (AppUser user : userRepository.list("id in ?1", ids)) {
            map.put(user.getId(), user);
        }
        return map;
    }

    private Map<Long, Task> loadTasks(Set<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        Map<Long, Task> map = new HashMap<>();
        for (Task task : taskRepository.list("taskId in ?1", ids)) {
            map.put(task.getTaskId(), task);
        }
        return map;
    }

    private static NotificationResponse toResponse(Notification n, AppUser actor, Task task) {
        String actorName = null;
        if (actor != null) {
            actorName = ((actor.getFirstName() != null ? actor.getFirstName() : "")
                    + " "
                    + (actor.getLastName() != null ? actor.getLastName() : "")).trim();
            if (actorName.isBlank()) actorName = actor.getEmail();
        }
        return NotificationResponse.builder()
                .id(n.getId())
                .recipientId(n.getRecipientId())
                .actorId(n.getActorId())
                .actorName(actorName)
                .taskId(n.getTaskId())
                .taskTitle(task != null ? task.getTaskTitle() : null)
                .type(n.getType())
                .title(n.getTitle())
                .body(n.getBody())
                .read(n.getReadAt() != null)
                .readAt(n.getReadAt())
                .createdAt(n.getCreatedAt())
                .build();
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) return value;
        return value.substring(0, max);
    }
}
