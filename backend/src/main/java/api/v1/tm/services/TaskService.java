package api.v1.tm.services;

import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.entity.Task;
import io.smallrye.mutiny.Uni;
import org.jboss.resteasy.reactive.multipart.FileUpload;

public interface TaskService {

    Uni<Task> createTask(TaskRequest request);

    Uni<Task> assignTask(AssignTaskRequest request);

    /**
     * @param page     0-based page index
     * @param size     items per page (1–100)
     * @param status   optional status filter
     * @param priority optional priority filter
     */
    Uni<PagedResponse<Task>> getAllTasks(int page, int size, String status, String priority);

    Uni<Task> getTaskById(Long taskId);

    Uni<Task> updateTaskStatus(Long taskId, String newStatus);

    Uni<Task> uploadFile(Long taskId, FileUpload file);
}
