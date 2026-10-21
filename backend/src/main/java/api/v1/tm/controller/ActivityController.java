package api.v1.tm.controller;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.services.TaskActivityService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Global audit trail for supervisors and admins.
 */
@Slf4j
@Path("/tm/api/v1/activity")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
@RequiredArgsConstructor
public class ActivityController {

    private final TaskActivityService activityService;

    @GET
    @Blocking
    public Response listActivity(
            @QueryParam("page")       @DefaultValue("0")  @Min(0)           int page,
            @QueryParam("size")       @DefaultValue("50") @Min(1) @Max(100) int size,
            @QueryParam("actorId")    Long actorId,
            @QueryParam("actionType") String actionType,
            @QueryParam("taskId")     Long taskId) {
        return Response.ok(ApiResponse.success(
                activityService.listAll(page, size, actorId, actionType, taskId))).build();
    }
}
