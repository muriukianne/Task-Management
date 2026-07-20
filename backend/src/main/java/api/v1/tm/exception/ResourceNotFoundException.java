package api.v1.tm.exception;

public class ResourceNotFoundException extends AppException {

    public ResourceNotFoundException(String message) {
        super(message, 404);
    }

    public static ResourceNotFoundException task(Long id) {
        return new ResourceNotFoundException("Task not found with id: " + id);
    }

    public static ResourceNotFoundException user(String id) {
        return new ResourceNotFoundException("User not found with id: " + id);
    }

    public static ResourceNotFoundException user(Long id) {
        return new ResourceNotFoundException("User not found with id: " + id);
    }
}
