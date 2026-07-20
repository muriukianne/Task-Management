package api.v1.tm.exception;

public class BusinessException extends AppException {

    public BusinessException(String message) {
        super(message, 400);
    }
}
