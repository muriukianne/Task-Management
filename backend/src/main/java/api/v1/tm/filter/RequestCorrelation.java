package api.v1.tm.filter;

import org.slf4j.MDC;

import java.time.Instant;
import java.util.UUID;

/**
 * Request-scoped identifiers stored in SLF4J MDC so logs and {@code ApiResponse}
 * share the same {@code requestId} / {@code correlationId}.
 *
 * <p>{@code requestId} is unique per HTTP call. {@code correlationId} is accepted
 * from the client (to tie a UI session or multi-call flow) and falls back to the
 * request id when the header is absent.
 */
public final class RequestCorrelation {

    public static final String MDC_REQUEST_ID = "requestId";
    public static final String MDC_CORRELATION_ID = "correlationId";

    public static final String HEADER_REQUEST_ID = "X-Request-Id";
    public static final String HEADER_CORRELATION_ID = "X-Correlation-Id";

    private RequestCorrelation() {
    }

    public static String requestId() {
        return MDC.get(MDC_REQUEST_ID);
    }

    public static String correlationId() {
        return MDC.get(MDC_CORRELATION_ID);
    }

    public static String timestamp() {
        return Instant.now().toString();
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }

    public static void bind(String requestId, String correlationId) {
        if (requestId != null && !requestId.isBlank()) {
            MDC.put(MDC_REQUEST_ID, requestId.trim());
        }
        if (correlationId != null && !correlationId.isBlank()) {
            MDC.put(MDC_CORRELATION_ID, correlationId.trim());
        }
    }

    public static void clear() {
        MDC.remove(MDC_REQUEST_ID);
        MDC.remove(MDC_CORRELATION_ID);
    }
}
