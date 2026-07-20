package api.v1.tm.controller;

import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.requests.UpdateStatusRequest;
import api.v1.tm.dtos.responses.ApiResponse;
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

    @POST
    @Blocking
    public Uni<Response> createTask(@Valid TaskRequest request) {
        return taskService.createTask(request)
                .map(task -> Response.status(Response.Status.CREATED)
                        .entity(ApiResponse.created(task))
                        .build());
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
    public Uni<Response> getAllTasks(
            @QueryParam("page")     @DefaultValue("0")  @Min(0)           int page,
            @QueryParam("size")     @DefaultValue("20") @Min(1) @Max(100) int size,
            @QueryParam("status")   String status,
            @QueryParam("priority") String priority) {
        return taskService.getAllTasks(page, size, status, priority)
                .map(paged -> Response.ok(ApiResponse.success(paged)).build());
    }

    @GET
    @Path("/{taskId}")
    @Blocking
    public Uni<Response> getTaskById(@PathParam("taskId") Long taskId) {
        return taskService.getTaskById(taskId)
                .map(task -> Response.ok(ApiResponse.success(task)).build());
    }

    @PUT
    @Path("/{taskId}/status")
    @Blocking
    public Uni<Response> updateTaskStatus(
            @PathParam("taskId") Long taskId,
            @Valid UpdateStatusRequest request) {
        return taskService.updateTaskStatus(taskId, request.getNewStatus())
                .map(task -> Response.ok(ApiResponse.success("Status updated", task)).build());
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
        return taskService.uploadFile(taskId, file)
                .map(task -> Response.ok(ApiResponse.success("File uploaded successfully", task)).build());
    }
}
