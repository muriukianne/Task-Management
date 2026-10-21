package api.v1.tm.filter;

import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.Router;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Vert.x-level CORS filter.
 * Allowed origins are read from the CORS_ORIGINS environment variable
 * (comma-separated), defaulting to localhost:3000 for local development.
 */
@Slf4j
@ApplicationScoped
public class CORSFilter {

    private static final String ALLOW_METHODS = "GET,POST,PUT,DELETE,OPTIONS,PATCH";
    private static final String ALLOW_HEADERS =
            "Content-Type,Authorization,apikey,Accept,X-Requested-With,X-Request-Id,X-Correlation-Id";
    private static final String EXPOSE_HEADERS = "X-Request-Id,X-Correlation-Id";

    @ConfigProperty(name = "cors.allowed-origins", defaultValue = "http://localhost:3000")
    String allowedOriginsConfig;

    public void addCORS(@Observes Router router) {
        Set<String> allowed = Arrays.stream(allowedOriginsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        log.info("CORS allowed origins: {}", allowed);

        router.route().order(Integer.MIN_VALUE).handler(ctx -> {
            String origin = ctx.request().getHeader("Origin");

            if (origin != null && allowed.contains(origin)) {
                ctx.response().headers()
                        .set("Access-Control-Allow-Origin",      origin)
                        .set("Access-Control-Allow-Methods",     ALLOW_METHODS)
                        .set("Access-Control-Allow-Headers",     ALLOW_HEADERS)
                        .set("Access-Control-Expose-Headers",    EXPOSE_HEADERS)
                        .set("Access-Control-Allow-Credentials", "true")
                        .set("Access-Control-Max-Age",           "3600")
                        .set("Vary",                              "Origin");
            }

            if (HttpMethod.OPTIONS.equals(ctx.request().method())) {
                ctx.response().setStatusCode(204).end();
            } else {
                ctx.next();
            }
        });
    }
}
