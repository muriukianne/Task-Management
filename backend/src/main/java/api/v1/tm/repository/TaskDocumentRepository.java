package api.v1.tm.repository;

import api.v1.tm.entity.TaskDocument;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class TaskDocumentRepository implements PanacheRepositoryBase<TaskDocument, Long> {

    public List<TaskDocument> findByTaskIdDesc(Long taskId) {
        return find("taskId", Sort.by("createdAt").descending(), taskId).list();
    }

    public Optional<TaskDocument> findByIdAndTaskId(Long id, Long taskId) {
        return find("id = ?1 and taskId = ?2", id, taskId).firstResultOptional();
    }
}
