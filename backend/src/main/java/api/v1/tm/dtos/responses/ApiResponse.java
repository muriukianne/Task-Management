package api.v1.tm.dtos.responses;

import api.v1.tm.exception.ErrorCodes;
import api.v1.tm.filter.RequestCorrelation;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * Unified API response envelope used for every JSON success and error payload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
public class ApiResponse<T> implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @JsonProperty("requestId")
    private String requestId;

    @JsonProperty("correlationId")
    private String correlationId;

    @JsonProperty("responseCode")
    private String responseCode;

    @JsonProperty("responseMessage")
    private String responseMessage;

    @JsonProperty("errorCode")
    private String errorCode;

    @JsonProperty("errorMessage")
    private String errorMessage;

    @JsonProperty("technicalMessage")
    private String technicalMessage;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("data")
    private T data;

    /** Fills identifiers/timestamp from MDC when a factory or mapper omitted them. */
    public void enrichFromMdc() {
        if (requestId == null) {
            requestId = RequestCorrelation.requestId();
        }
        if (correlationId == null) {
            correlationId = RequestCorrelation.correlationId();
        }
        if (timestamp == null) {
            timestamp = RequestCorrelation.timestamp();
        }
    }

    // ── Factory methods ───────────────────────────────────────────────────────

    public static <T> ApiResponse<T> success(T data) {
        return success("Success", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>base()
                .responseCode("200")
                .responseMessage(message)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> created(T data) {
        return ApiResponse.<T>base()
                .responseCode("201")
                .responseMessage("Created successfully")
                .data(data)
                .build();
    }

    public static ApiResponse<?> error(int status, String message) {
        return error(status, ErrorCodes.forHttpStatus(status), message, null);
    }

    public static ApiResponse<?> error(int status, String errorCode, String errorMessage) {
        return error(status, errorCode, errorMessage, null);
    }

    public static ApiResponse<?> error(
            int status,
            String errorCode,
            String errorMessage,
            String technicalMessage) {
        return base()
                .responseCode(String.valueOf(status))
                .responseMessage(errorMessage)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .technicalMessage(technicalMessage)
                .build();
    }

    public static ApiResponse<?> validationError(List<String> errors) {
        String joined = errors == null || errors.isEmpty()
                ? "Validation failed"
                : String.join("; ", errors);
        return error(400, ErrorCodes.VALIDATION_ERROR, joined, "Validation failed");
    }

    private static <T> ApiResponseBuilder<T> base() {
        return ApiResponse.<T>builder()
                .requestId(RequestCorrelation.requestId())
                .correlationId(RequestCorrelation.correlationId())
                .timestamp(RequestCorrelation.timestamp());
    }
}
