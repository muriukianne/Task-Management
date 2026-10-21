package api.v1.tm.controller;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.scheduler.DueDateAlertJob;
import api.v1.tm.utils.JwtHelper;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

/**
 * Privileged endpoint to run the due-date alert scan on demand (daily cron also runs at 08:00).
 */
@Slf4j
@Path("/tm/api/v1/due-alerts")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
@RequiredArgsConstructor
public class DueAlertController {

    private final DueDateAlertJob dueDateAlertJob;
    private final JwtHelper jwt;

    @POST
    @Path("/run")
    @Blocking
    public Response runNow() {
        jwt.requirePrivileged("run due-date alerts");
        dueDateAlertJob.scanDueDates();
        return Response.ok(ApiResponse.success(Map.of("status", "ok"))).build();
    }
}
