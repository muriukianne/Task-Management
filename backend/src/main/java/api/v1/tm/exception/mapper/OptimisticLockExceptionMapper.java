package api.v1.tm.exception.mapper;

import api.v1.tm.dtos.responses.ApiResponse;
import api.v1.tm.exception.ErrorCodes;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.PersistenceException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * Maps JPA optimistic-lock failures to HTTP 409 Conflict.
 * Also unwraps {@link PersistenceException} when the root cause is an
 * {@link OptimisticLockException} (common after transactional interceptors).
 */
@Slf4j
@Provider
public class OptimisticLockExceptionMapper implements ExceptionMapper<PersistenceException> {

    private static final String MESSAGE =
            "This task was modified by someone else. Refresh to load the latest state, then try again.";

    @Override
    public Response toResponse(PersistenceException ex) {
        if (!isOptimisticLock(ex)) {
            log.error("Unhandled persistence exception", ex);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .type(MediaType.APPLICATION_JSON_TYPE)
                    .entity(ApiResponse.error(
                            500,
                            ErrorCodes.DATABASE_ERROR,
                            "A database error occurred",
                            ex.getClass().getSimpleName()))
                    .build();
        }

        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        return Response.status(Response.Status.CONFLICT)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(ApiResponse.error(409, ErrorCodes.CONFLICT, MESSAGE, "OptimisticLockException"))
                .build();
    }

    private static boolean isOptimisticLock(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof OptimisticLockException) {
                return true;
            }
            // Hibernate-specific stale state (sometimes not wrapped as JPA OLE)
            if (t.getClass().getName().contains("StaleObjectStateException")
                    || t.getClass().getName().contains("OptimisticEntityLockException")) {
                return true;
            }
        }
        return false;
    }
}
