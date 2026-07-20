package api.v1.tm.dtos.responses;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * Unified API response envelope.
 * Replaces the old ResponseArray pattern which incorrectly returned HTTP 200 for errors.
 * All error cases now use the correct HTTP status code on the wire.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private boolean success;
    private int status;
    private String message;
    private T data;
    private List<String> errors;

    @Builder.Default
    private long timestamp = System.currentTimeMillis();

    // ── Factory methods ───────────────────────────────────────────────────────

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .status(200)
                .message("Success")
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .status(200)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> created(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .status(201)
                .message("Created successfully")
                .data(data)
                .build();
    }

    public static ApiResponse<?> error(int status, String message) {
        return ApiResponse.builder()
                .success(false)
                .status(status)
                .message(message)
                .build();
    }

    public static ApiResponse<?> validationError(List<String> errors) {
        return ApiResponse.builder()
                .success(false)
                .status(400)
                .message("Validation failed")
                .errors(errors)
                .build();
    }
}
