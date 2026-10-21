package api.v1.tm.exception.mapper;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.exception.ErrorCodes;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Provider
public class IllegalArgumentExceptionMapper implements ExceptionMapper<IllegalArgumentException> {

    @Override
    public Response toResponse(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(ApiResponse.error(
                        400,
                        ErrorCodes.BAD_REQUEST,
                        ex.getMessage() != null ? ex.getMessage() : "Invalid request",
                        "IllegalArgumentException"))
                .build();
    }
}
