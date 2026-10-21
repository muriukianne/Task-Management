package api.v1.tm.repository;

import api.v1.tm.entity.TaskDependency;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class TaskDependencyRepository implements PanacheRepository<TaskDependency> {

    /** Tasks that {@code taskId} depends on (blockers). */
    public List<TaskDependency> findByTaskId(Long taskId) {
        return list("taskId", taskId);
    }

    /** Tasks that depend on {@code dependsOnTaskId} (dependents). */
    public List<TaskDependency> findByDependsOnTaskId(Long dependsOnTaskId) {
        return list("dependsOnTaskId", dependsOnTaskId);
    }

    public Optional<TaskDependency> findEdge(Long taskId, Long dependsOnTaskId) {
        return find("taskId = ?1 and dependsOnTaskId = ?2", taskId, dependsOnTaskId)
                .firstResultOptional();
    }

    public void deleteEdge(Long taskId, Long dependsOnTaskId) {
        delete("taskId = ?1 and dependsOnTaskId = ?2", taskId, dependsOnTaskId);
    }
}
