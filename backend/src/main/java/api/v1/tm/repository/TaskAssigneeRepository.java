package api.v1.tm.repository;

import api.v1.tm.entity.TaskAssignee;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class TaskAssigneeRepository implements PanacheRepository<TaskAssignee> {

    public List<TaskAssignee> findByTaskId(Long taskId) {
        return list("taskId", taskId);
    }

    public List<TaskAssignee> findByUserId(Long userId) {
        return list("userId", userId);
    }

    public Optional<TaskAssignee> findByTaskAndUser(Long taskId, Long userId) {
        return find("taskId = ?1 and userId = ?2", taskId, userId).firstResultOptional();
    }

    public boolean isAssignee(Long taskId, Long userId) {
        return count("taskId = ?1 and userId = ?2", taskId, userId) > 0;
    }

    public void deleteByTaskId(Long taskId) {
        delete("taskId", taskId);
    }

    public long countByUserId(Long userId) {
        return count("userId", userId);
    }
}
