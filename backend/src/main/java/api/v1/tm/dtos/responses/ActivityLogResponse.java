package api.v1.tm.dtos.responses;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Enriched audit-trail row for supervisor/admin visibility.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ActivityLogResponse {

    private Long id;
    private Long taskId;
    private String taskTitle;
    private Long actorId;
    private String actorName;
    private String actorEmail;
    private String actorRole;
    private String actionType;
    private String oldValue;
    private String newValue;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
