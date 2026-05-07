package api.v1.tm.filter;

import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.Router;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

@ApplicationScoped
public class CORSFilter {

    private static final String ALLOW_ORIGIN  = "http://localhost:3000";
    private static final String ALLOW_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
    private static final String ALLOW_HEADERS = "Content-Type,Authorization,apikey,Accept";

    public void addCORS(@Observes Router router) {
        router.route().order(Integer.MIN_VALUE).handler(ctx -> {
            ctx.response().headers()
                    .set("Access-Control-Allow-Origin",  ALLOW_ORIGIN)
                    .set("Access-Control-Allow-Methods", ALLOW_METHODS)
                    .set("Access-Control-Allow-Headers", ALLOW_HEADERS)
                    .set("Access-Control-Max-Age",       "3600");

            if (HttpMethod.OPTIONS.equals(ctx.request().method())) {
                ctx.response().setStatusCode(204).end();
            } else {
                ctx.next();
            }
        });
    }
}
