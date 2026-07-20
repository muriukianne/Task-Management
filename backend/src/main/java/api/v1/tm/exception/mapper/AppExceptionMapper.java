package api.v1.tm.exception.mapper;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.exception.AppException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Provider
public class AppExceptionMapper implements ExceptionMapper<AppException> {

    @Override
    public Response toResponse(AppException ex) {
        log.warn("Application exception [{}] status={}: {}",
                ex.getClass().getSimpleName(), ex.getHttpStatus(), ex.getMessage());
        return Response.status(ex.getHttpStatus())
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(ApiResponse.error(ex.getHttpStatus(), ex.getMessage()))
                .build();
    }
}
