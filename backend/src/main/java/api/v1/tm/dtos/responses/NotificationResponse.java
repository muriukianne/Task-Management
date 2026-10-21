package api.v1.tm.dtos.responses;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationResponse {

    private Long id;
    private Long recipientId;
    private Long actorId;
    private String actorName;
    private Long taskId;
    private String taskTitle;
    private String type;
    private String title;
    private String body;
    private boolean read;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime readAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
