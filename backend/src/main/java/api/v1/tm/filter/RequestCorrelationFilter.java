package api.v1.tm.filter;

import api.v1.tm.dtos.responses.ApiResponse;
import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

/**
 * Binds request/correlation IDs into MDC on the way in, echoes them on the
 * response, and fills any missing envelope identifiers before the body is written.
 */
@Provider
@Priority(Priorities.AUTHENTICATION - 100)
public class RequestCorrelationFilter implements ContainerRequestFilter, ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext request) {
        String requestId = firstNonBlank(
                request.getHeaderString(RequestCorrelation.HEADER_REQUEST_ID),
                RequestCorrelation.newId());
        String correlationId = firstNonBlank(
                request.getHeaderString(RequestCorrelation.HEADER_CORRELATION_ID),
                requestId);
        RequestCorrelation.bind(requestId, correlationId);
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        String requestId = RequestCorrelation.requestId();
        String correlationId = RequestCorrelation.correlationId();

        if (requestId != null) {
            response.getHeaders().putSingle(RequestCorrelation.HEADER_REQUEST_ID, requestId);
        }
        if (correlationId != null) {
            response.getHeaders().putSingle(RequestCorrelation.HEADER_CORRELATION_ID, correlationId);
        }

        Object entity = response.getEntity();
        if (entity instanceof ApiResponse<?> envelope) {
            envelope.enrichFromMdc();
        }

        RequestCorrelation.clear();
    }

    private static String firstNonBlank(String value, String fallback) {
        return value != null && !value.isBlank() ? value.trim() : fallback;
    }
}
