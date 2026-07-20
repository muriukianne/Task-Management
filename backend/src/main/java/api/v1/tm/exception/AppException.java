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
}
