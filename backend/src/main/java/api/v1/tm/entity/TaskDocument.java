package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "task_documents",
    indexes = {
        @Index(name = "idx_task_documents_task_id", columnList = "task_id"),
        @Index(name = "idx_task_documents_task_created", columnList = "task_id, created_at")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;

    /** On-disk filename under the task-uploads directory. */
    @Column(name = "stored_name", nullable = false, length = 512, unique = true)
    private String storedName;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
