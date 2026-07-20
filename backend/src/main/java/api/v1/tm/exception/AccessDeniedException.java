package api.v1.tm.exception;

public class AccessDeniedException extends AppException {

    public AccessDeniedException(String message) {
        super(message, 403);
    }
}
