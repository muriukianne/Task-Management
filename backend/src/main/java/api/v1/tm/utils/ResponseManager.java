package api.v1.tm.utils;

import io.smallrye.mutiny.Uni;
import api.v1.tm.config.ApplicationProperties;
import api.v1.tm.dtos.responses.ResponseArray;
import jakarta.enterprise.context.ApplicationScoped;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@ApplicationScoped
@RequiredArgsConstructor
public class ResponseManager {
    private final ApplicationProperties applicationProperties;

    public Uni<ResponseArray<?>> onHandleErrorResponse(String errorMessage) {
        log.warn("Response error: {}", errorMessage);
        return Uni.createFrom().item(ResponseArray.builder()
                        .code(applicationProperties.validateErrorCode())
                        .msg(errorMessage)
                    .build());
    }

    public Uni<ResponseArray<?>> onHandleSuccessResponse() {
        return Uni.createFrom().item(ResponseArray.builder()
                        .code(applicationProperties.successResponseCode())
                        .msg(applicationProperties.successMessage())
                    .build());
    }
    public Uni<ResponseArray<?>> onHandleSuccessResponse(Object data) {
        return Uni.createFrom().item(ResponseArray.builder()
                .code(applicationProperties.successResponseCode())
                .msg(applicationProperties.successMessage())
                .data(data)
                .build());
    }
    
    public Uni<ResponseArray<?>> onHandleSuccessResponse(String message, Object data) {
        return Uni.createFrom().item(ResponseArray.builder()
                .code(applicationProperties.successResponseCode())
                .msg(message)
                .data(data)
                .build());
    }
}

