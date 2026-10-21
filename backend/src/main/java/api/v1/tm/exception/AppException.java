package api.v1.tm.exception;

public abstract class AppException extends RuntimeException {

    private final int httpStatus;

    protected AppException(String message, int httpStatus) {
        super(message);
        this.httpStatus = httpStatus;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getErrorCode() {
        return switch (this) {
            case ResourceNotFoundException ignored -> ErrorCodes.NOT_FOUND;
            case AccessDeniedException ignored -> ErrorCodes.FORBIDDEN;
            case ConflictException ignored -> ErrorCodes.CONFLICT;
            case BusinessException ignored -> ErrorCodes.BUSINESS_ERROR;
            default -> ErrorCodes.forHttpStatus(httpStatus);
        };
    }
}
