package api.v1.tm.exception.mapper;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.exception.ErrorCodes;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * Wraps JAX-RS {@link WebApplicationException} (404, 405, 401 from the runtime)
 * in the unified envelope when the original response is not already an {@link ApiResponse}.
 */
@Slf4j
@Provider
public class WebApplicationExceptionMapper implements ExceptionMapper<WebApplicationException> {

    @Override
    public Response toResponse(WebApplicationException ex) {
        Response original = ex.getResponse();
        if (original != null && original.getEntity() instanceof ApiResponse<?>) {
            return original;
        }

        int status = original != null ? original.getStatus() : 500;
        String reason = Response.Status.fromStatusCode(status) != null
                ? Response.Status.fromStatusCode(status).getReasonPhrase()
                : "Request failed";
        String message = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage()
                : reason;

        log.warn("WebApplicationException status={}: {}", status, message);
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(ApiResponse.error(status, ErrorCodes.forHttpStatus(status), message,
                        ex.getClass().getSimpleName()))
                .build();
    }
}
