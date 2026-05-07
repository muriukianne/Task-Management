package api.v1.tm.services;

import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.ResponseArray;
import io.smallrye.mutiny.Uni;
import org.jboss.resteasy.reactive.multipart.FileUpload;

public interface TaskService {
    Uni<ResponseArray<?>> createTask(TaskRequest request);
    Uni<ResponseArray<?>> assignTask(AssignTaskRequest request);
    Uni<ResponseArray<?>> getAllTasks();
    Uni<ResponseArray<?>> getTaskById(Long taskId);
    Uni<ResponseArray<?>> updateTaskStatus(Long taskId, String newStatus);
    Uni<ResponseArray<?>> uploadFile(Long taskId, FileUpload file);
}
