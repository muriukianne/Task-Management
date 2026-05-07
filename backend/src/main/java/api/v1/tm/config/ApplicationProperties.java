package api.v1.tm.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "api.v1.tm")
public interface ApplicationProperties {
    String successMessage();

    Integer successResponseCode();

    int webClientPoolSize();

    int validateErrorCode();
}
