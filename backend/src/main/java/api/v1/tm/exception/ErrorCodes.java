package api.v1.tm.exception;

/**
 * Stable machine-readable codes placed on {@code ApiResponse.errorCode}.
 */
public final class ErrorCodes {

    public static final String BAD_REQUEST = "BAD_REQUEST";
    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String CONFLICT = "CONFLICT";
    public static final String GONE = "GONE";
    public static final String BUSINESS_ERROR = "BUSINESS_ERROR";
    public static final String DATABASE_ERROR = "DATABASE_ERROR";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private ErrorCodes() {
    }

    public static String forHttpStatus(int status) {
        return switch (status) {
            case 400 -> BAD_REQUEST;
            case 401 -> UNAUTHORIZED;
            case 403 -> FORBIDDEN;
            case 404 -> NOT_FOUND;
            case 409 -> CONFLICT;
            case 410 -> GONE;
            default -> status >= 500 ? INTERNAL_ERROR : BAD_REQUEST;
        };
    }
}
