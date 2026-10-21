package api.v1.tm.exception.mapper;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.exception.ErrorCodes;
import api.v1.tm.filter.RequestCorrelation;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * Last-resort mapper so unexpected failures still return the unified envelope
 * instead of Quarkus's default HTML/text error page.
 */
@Slf4j
@Provider
public class UnhandledExceptionMapper implements ExceptionMapper<Exception> {

    @Override
    public Response toResponse(Exception ex) {
        log.error("Unhandled exception [req={} corr={}]: {}",
                RequestCorrelation.requestId(),
                RequestCorrelation.correlationId(),
                ex.getMessage(),
                ex);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(ApiResponse.error(
                        500,
                        ErrorCodes.INTERNAL_ERROR,
                        "An unexpected error occurred",
                        ex.getClass().getSimpleName()))
                .build();
    }
}
