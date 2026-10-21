package api.v1.tm.controller;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.services.DashboardService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Aggregated dashboard analytics. Response shape is identical for all roles;
 * the service scopes queries by JWT role (personal vs team).
 */
@Slf4j
@Path("/tm/api/v1/dashboard")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GET
    @Path("/metrics")
    @Blocking
    public Response getMetrics() {
        return Response.ok(ApiResponse.success(dashboardService.getMetrics())).build();
    }
}
