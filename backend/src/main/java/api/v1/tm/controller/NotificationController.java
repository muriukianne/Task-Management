package api.v1.tm.controller;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.services.NotificationService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@Path("/tm/api/v1/notifications")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GET
    @Blocking
    public Response list(
            @QueryParam("page")       @DefaultValue("0")  @Min(0)           int page,
            @QueryParam("size")       @DefaultValue("20") @Min(1) @Max(50)  int size,
            @QueryParam("unreadOnly") @DefaultValue("false") boolean unreadOnly) {
        return Response.ok(ApiResponse.success(
                notificationService.listMine(page, size, unreadOnly))).build();
    }

    @GET
    @Path("/unread-count")
    @Blocking
    public Response unreadCount() {
        return Response.ok(ApiResponse.success(
                Map.of("count", notificationService.unreadCount()))).build();
    }

    @POST
    @Path("/{id}/read")
    @Blocking
    public Response markRead(@PathParam("id") Long id) {
        return Response.ok(ApiResponse.success(notificationService.markRead(id))).build();
    }

    @POST
    @Path("/read-all")
    @Blocking
    public Response markAllRead() {
        int updated = notificationService.markAllRead();
        return Response.ok(ApiResponse.success(
                Map.of("marked", updated))).build();
    }
}
