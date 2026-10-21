package api.v1.tm.scheduler;

import api.v1.tm.entity.Task;
import api.v1.tm.entity.TaskAssignee;
import api.v1.tm.notification.NotificationType;
import api.v1.tm.repository.TaskAssigneeRepository;
import api.v1.tm.repository.TaskRepository;
import api.v1.tm.services.NotificationService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Daily due-date alerts for open tasks (all assignees + assigner for overdue).
 * Deduped once per recipient/task/type per calendar day.
 */
@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class DueDateAlertJob {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository assigneeRepository;
    private final NotificationService notificationService;

    @ConfigProperty(name = "tm.due-alerts.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "tm.due-alerts.soon-days", defaultValue = "3")
    int soonDays;

    @Scheduled(cron = "{tm.due-alerts.cron}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    public void scanDueDates() {
        if (!enabled) {
            return;
        }

        LocalDate today = LocalDate.now();
        LocalDate soonEnd = today.plusDays(Math.max(0, soonDays));

        List<Task> open = taskRepository.findOpenWithDueDate();
        int dueSoon = 0;
        int dueToday = 0;
        int overdue = 0;

        for (Task task : open) {
            LocalDate due = task.getDueDate();
            if (due == null || task.getAssignedTo() == null) {
                continue;
            }

            if (due.isBefore(today)) {
                alertOverdue(task, due, today);
                overdue++;
            } else if (due.isEqual(today)) {
                alertDueToday(task, due);
                dueToday++;
            } else if (!due.isAfter(soonEnd)) {
                alertDueSoon(task, due, today);
                dueSoon++;
            }
        }

        log.info("Due-date alert scan complete: openWithDue={} dueSoon={} dueToday={} overdue={}",
                open.size(), dueSoon, dueToday, overdue);
    }

    private void alertDueSoon(Task task, LocalDate due, LocalDate today) {
        long days = ChronoUnit.DAYS.between(today, due);
        String title = "Due soon: \"" + task.getTaskTitle() + "\"";
        String body = "Due in " + days + " day" + (days == 1 ? "" : "s")
                + " (" + due.format(DAY) + ").";
        notifyAssignees(task, NotificationType.DUE_SOON, title, body);
    }

    private void alertDueToday(Task task, LocalDate due) {
        String title = "Due today: \"" + task.getTaskTitle() + "\"";
        String body = "This task is due today (" + due.format(DAY) + ").";
        notifyAssignees(task, NotificationType.DUE_TODAY, title, body);
    }

    private void alertOverdue(Task task, LocalDate due, LocalDate today) {
        long days = ChronoUnit.DAYS.between(due, today);
        String title = "Overdue: \"" + task.getTaskTitle() + "\"";
        String body = "Overdue by " + days + " day" + (days == 1 ? "" : "s")
                + " (was due " + due.format(DAY) + ").";
        Set<Long> recipients = assigneeIds(task);
        for (Long userId : recipients) {
            notificationService.notifyOncePerDay(
                    userId, null, task.getTaskId(),
                    NotificationType.OVERDUE, title, body);
        }
        if (task.getAssignedBy() != null && !recipients.contains(task.getAssignedBy())) {
            notificationService.notifyOncePerDay(
                    task.getAssignedBy(), null, task.getTaskId(),
                    NotificationType.OVERDUE,
                    "Team overdue: \"" + task.getTaskTitle() + "\"",
                    body);
        }
    }

    private void notifyAssignees(Task task, String type, String title, String body) {
        for (Long userId : assigneeIds(task)) {
            notificationService.notifyOncePerDay(
                    userId, null, task.getTaskId(), type, title, body);
        }
    }

    private Set<Long> assigneeIds(Task task) {
        Set<Long> ids = new LinkedHashSet<>();
        if (task.getAssignedTo() != null) {
            ids.add(task.getAssignedTo());
        }
        for (TaskAssignee a : assigneeRepository.findByTaskId(task.getTaskId())) {
            ids.add(a.getUserId());
        }
        return ids;
    }
}
