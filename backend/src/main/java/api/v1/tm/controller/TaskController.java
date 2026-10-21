package api.v1.tm.controller;

import api.v1.tm.dtos.requests.AddDependencyRequest;
import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.CreateCommentRequest;
import api.v1.tm.dtos.requests.ParseTaskTextRequest;
import api.v1.tm.dtos.requests.RejectTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.requests.UpdateStatusRequest;
import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.services.NaturalLanguageTaskParser;
import api.v1.tm.services.TaskService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Slf4j
@Path("/tm/api/v1/tasks")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final NaturalLanguageTaskParser naturalLanguageTaskParser;

    @POST
    @Blocking
    public Uni<Response> createTask(@Valid TaskRequest request) {
        return taskService.createTask(request)
                .map(task -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(task))
                        .build());
    }

    /**
     * Preview structured fields extracted from free-text input.
     * Does not persist — caller confirms and submits via {@link #createTask}.
     */
    @POST
    @Path("/parse")
    @Blocking
    public Response parseTaskText(@Valid ParseTaskTextRequest request) {
        return Response.ok(ApiResponse.success(naturalLanguageTaskParser.parse(request.getText()))).build();
    }

    @POST
    @Path("/assign")
    @Blocking
    public Uni<Response> assignTask(@Valid AssignTaskRequest request) {
        return taskService.assignTask(request)
                .map(task -> Response.ok(ApiResponse.success(task)).build());
    }

    @GET
    @Blocking
    public Response getAllTasks(
            @QueryParam("page")     @DefaultValue("0")  @Min(0)           int page,
            @QueryParam("size")     @DefaultValue("20") @Min(1) @Max(100) int size,
            @QueryParam("status")   String status,
            @QueryParam("priority") String priority) {
        return Response.ok(ApiResponse.success(
                taskService.getAllTasks(page, size, status, priority))).build();
    }

    @GET
    @Path("/{taskId}")
    @Blocking
    public Response getTaskById(@PathParam("taskId") Long taskId) {
        return Response.ok(ApiResponse.success(taskService.getTaskById(taskId))).build();
    }

    @PUT
    @Path("/{taskId}/status")
    @Blocking
    public Uni<Response> updateTaskStatus(
            @PathParam("taskId") Long taskId,
            @Valid UpdateStatusRequest request) {
        return taskService.updateTaskStatus(taskId, request.getNewStatus(), request.getVersion())
                .map(task -> Response.ok(ApiResponse.success("Status updated", task)).build());
    }

    /** Supervisor/admin: send a resolved task back to in_progress with a required reason. */
    @POST
    @Path("/{taskId}/reject")
    @Blocking
    public Uni<Response> rejectTask(
            @PathParam("taskId") Long taskId,
            @Valid RejectTaskRequest request) {
        return taskService.rejectTask(taskId, request)
                .map(task -> Response.ok(ApiResponse.success("Task rejected", task)).build());
    }

    @POST
    @Path("/{taskId}/dependencies")
    @Blocking
    public Uni<Response> addDependency(
            @PathParam("taskId") Long taskId,
            @Valid AddDependencyRequest request) {
        return taskService.addDependency(taskId, request)
                .map(task -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(task))
                        .build());
    }

    @DELETE
    @Path("/{taskId}/dependencies/{dependsOnTaskId}")
    @Blocking
    public Uni<Response> removeDependency(
            @PathParam("taskId") Long taskId,
            @PathParam("dependsOnTaskId") Long dependsOnTaskId) {
        return taskService.removeDependency(taskId, dependsOnTaskId)
                .map(v -> Response.ok(ApiResponse.success("Dependency removed", null)).build());
    }

    @GET
    @Path("/{taskId}/comments")
    @Blocking
    public Response listComments(@PathParam("taskId") Long taskId) {
        return Response.ok(ApiResponse.success(taskService.listComments(taskId))).build();
    }

    @POST
    @Path("/{taskId}/comments")
    @Blocking
    public Uni<Response> addComment(
            @PathParam("taskId") Long taskId,
            @Valid CreateCommentRequest request) {
        return taskService.addComment(taskId, request)
                .map(comment -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(comment))
                        .build());
    }

    @POST
    @Path("/{taskId}/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Blocking
    public Uni<Response> uploadFile(
            @PathParam("taskId") Long taskId,
            @RestForm("file") FileUpload file) {
        if (file == null) {
            return Uni.createFrom().item(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(ApiResponse.error(400, "No file provided"))
                            .build());
        }
        return taskService.uploadDocument(taskId, file)
                .map(doc -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(doc))
                        .build());
    }

    @GET
    @Path("/{taskId}/documents")
    @Blocking
    public Response listDocuments(@PathParam("taskId") Long taskId) {
        return Response.ok(ApiResponse.success(taskService.listDocuments(taskId))).build();
    }

    @POST
    @Path("/{taskId}/documents")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Blocking
    public Uni<Response> uploadDocument(
            @PathParam("taskId") Long taskId,
            @RestForm("file") FileUpload file) {
        if (file == null) {
            return Uni.createFrom().item(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(ApiResponse.error(400, "No file provided"))
                            .build());
        }
        return taskService.uploadDocument(taskId, file)
                .map(doc -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(doc))
                        .build());
    }

    @GET
    @Path("/{taskId}/documents/{documentId}/download")
    @Blocking
    public Response downloadDocument(
            @PathParam("taskId") Long taskId,
            @PathParam("documentId") Long documentId) {
        var file = taskService.downloadDocument(taskId, documentId);
        return Response.ok(file.path().toFile())
                .type(file.contentType())
                .header("Content-Disposition",
                        "attachment; filename=\"" + file.originalName().replace("\"", "") + "\"")
                .header("Content-Length", file.sizeBytes())
                .build();
    }

    @DELETE
    @Path("/{taskId}/documents/{documentId}")
    @Blocking
    public Uni<Response> deleteDocument(
            @PathParam("taskId") Long taskId,
            @PathParam("documentId") Long documentId) {
        return taskService.deleteDocument(taskId, documentId)
                .map(v -> Response.ok(ApiResponse.success("Document deleted", null)).build());
    }
}
