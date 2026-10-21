package api.v1.tm.activity;

import api.v1.tm.services.TaskActivityService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import jakarta.inject.Inject;
import lombok.extern.slf4j.Slf4j;

/**
 * Persists audit rows when domain code fires {@link TaskActivityEvent}.
 * Uses {@link TransactionPhase#IN_PROGRESS} so the log commits with the task mutation.
 *
 * <p>Prefer CDI events over a Hibernate {@code @EntityListener}: actor identity comes from
 * the JWT / request scope, which entity listeners cannot reliably access.
 */
@Slf4j
@ApplicationScoped
public class TaskActivityEventListener {

    @Inject
    TaskActivityService activityService;

    public void onTaskActivity(
            @Observes(during = TransactionPhase.IN_PROGRESS) TaskActivityEvent event) {
        activityService.record(event);
    }
}
