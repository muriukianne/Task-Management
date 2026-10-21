package api.v1.tm.services;

import api.v1.tm.dtos.requests.AddDependencyRequest;
import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.CreateCommentRequest;
import api.v1.tm.dtos.requests.RejectTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.dtos.responses.TaskCommentResponse;
import api.v1.tm.dtos.responses.TaskDocumentFile;
import api.v1.tm.dtos.responses.TaskDocumentResponse;
import api.v1.tm.entity.Task;
import io.smallrye.mutiny.Uni;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.List;

public interface TaskService {

    Uni<Task> createTask(TaskRequest request);

    Uni<Task> assignTask(AssignTaskRequest request);

    PagedResponse<Task> getAllTasks(int page, int size, String status, String priority);

    Task getTaskById(Long taskId);

    Uni<Task> updateTaskStatus(Long taskId, String newStatus, Integer version);

    Uni<Task> rejectTask(Long taskId, RejectTaskRequest request);

    Uni<Task> addDependency(Long taskId, AddDependencyRequest request);

    Uni<Void> removeDependency(Long taskId, Long dependsOnTaskId);

    List<TaskCommentResponse> listComments(Long taskId);

    Uni<TaskCommentResponse> addComment(Long taskId, CreateCommentRequest request);

    /** @deprecated Prefer {@link #uploadDocument}; kept for backwards compatibility. */
    Uni<Task> uploadFile(Long taskId, FileUpload file);

    List<TaskDocumentResponse> listDocuments(Long taskId);

    Uni<TaskDocumentResponse> uploadDocument(Long taskId, FileUpload file);

    TaskDocumentFile downloadDocument(Long taskId, Long documentId);

    Uni<Void> deleteDocument(Long taskId, Long documentId);
}
