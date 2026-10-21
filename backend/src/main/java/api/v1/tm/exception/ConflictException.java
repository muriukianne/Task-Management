package api.v1.tm.exception;

/**
 * Explicit conflict when a client submits a stale {@code version} (OCC check
 * before flush). Hibernate's {@code OptimisticLockException} is mapped separately
 * to the same HTTP 409 envelope.
 */
public class ConflictException extends AppException {

    public ConflictException(String message) {
        super(message, 409);
    }

    public static ConflictException staleTask(Long taskId) {
        return new ConflictException(
                "Task " + taskId + " was modified by someone else. "
                + "Refresh to load the latest state, then try again.");
    }
}
