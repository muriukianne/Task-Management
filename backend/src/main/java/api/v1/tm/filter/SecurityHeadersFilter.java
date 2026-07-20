package api.v1.tm.filter;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

/**
 * Adds defensive HTTP security headers to every response.
 * HSTS is only added when the request was made over HTTPS to avoid breaking local dev.
 */
@Provider
public class SecurityHeadersFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext request,
                       ContainerResponseContext response) throws IOException {

        var headers = response.getHeaders();

        // Prevent MIME-type sniffing
        headers.putSingle("X-Content-Type-Options", "nosniff");

        // Deny framing (clickjacking protection)
        headers.putSingle("X-Frame-Options", "DENY");

        // Legacy XSS filter for older browsers
        headers.putSingle("X-XSS-Protection", "1; mode=block");

        // Limit referrer information on cross-origin requests
        headers.putSingle("Referrer-Policy", "strict-origin-when-cross-origin");

        // Disable unnecessary browser APIs
        headers.putSingle("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

        // HSTS only over HTTPS — adding it over HTTP would break the redirect loop
        String scheme = request.getUriInfo().getRequestUri().getScheme();
        if ("https".equalsIgnoreCase(scheme)) {
            headers.putSingle("Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains; preload");
        }
    }
}
