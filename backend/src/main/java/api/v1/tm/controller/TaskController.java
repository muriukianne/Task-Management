package api.v1.tm.controller;

import org.eclipse.microprofile.jwt.JsonWebToken;
import api.v1.tm.dtos.requests.AssignTaskRequest;
import api.v1.tm.dtos.requests.TaskRequest;
import api.v1.tm.dtos.requests.UpdateStatusRequest;
import api.v1.tm.dtos.responses.ResponseArray;
import api.v1.tm.services.TaskService;
import api.v1.tm.utils.ResponseManager;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
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

    private final ResponseManager responseManager;
    private final TaskService taskService;
    private final JsonWebToken jwt;

    @POST
    @Blocking
    public Uni<ResponseArray<?>> createTask(@Valid TaskRequest request) {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        log.info("User {} requesting task creation", userId);
        return taskService.createTask(request);
    }

    @POST
    @Path("/assign")
    @Blocking
    public Uni<ResponseArray<?>> assignTask(@Valid AssignTaskRequest request) {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        log.info("User {} requesting task assignment", userId);
        return taskService.assignTask(request);
    }

    @GET
    @Blocking
    public Uni<ResponseArray<?>> getAllTasks() {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        return taskService.getAllTasks();
    }

    @GET
    @Path("/{taskId}")
    @Blocking
    public Uni<ResponseArray<?>> getTaskById(@PathParam("taskId") Long taskId) {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        return taskService.getTaskById(taskId);
    }

    @PUT
    @Path("/{taskId}/status")
    @Blocking
    public Uni<ResponseArray<?>> updateTaskStatus(
            @PathParam("taskId") Long taskId,
            @Valid UpdateStatusRequest request) {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        log.info("User {} updating task {} to {}", userId, taskId, request.getNewStatus());
        return taskService.updateTaskStatus(taskId, request.getNewStatus());
    }

    @POST
    @Path("/{taskId}/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Blocking
    public Uni<ResponseArray<?>> uploadFile(
            @PathParam("taskId") Long taskId,
            @RestForm("file") FileUpload file) {
        String userId = jwt.getSubject();
        if (userId == null) return responseManager.onHandleErrorResponse("Invalid token: missing subject");
        if (file == null) return responseManager.onHandleErrorResponse("No file provided");
        log.info("User {} uploading file for task {}", userId, taskId);
        return taskService.uploadFile(taskId, file);
    }
}
