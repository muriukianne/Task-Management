package api.v1.tm.repository;

import api.v1.tm.entity.TaskComment;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class TaskCommentRepository implements PanacheRepositoryBase<TaskComment, Long> {

    /** Oldest → newest thread for a task. */
    public List<TaskComment> findByTaskIdAsc(Long taskId) {
        return find("taskId", Sort.by("createdAt").ascending(), taskId).list();
    }
}
