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
public class TaskDocumentResponse {

    private Long id;
    private Long taskId;
    private Long uploadedBy;
    private String uploaderName;
    private String uploaderRole;
    private String originalName;
    private String contentType;
    private Long sizeBytes;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
