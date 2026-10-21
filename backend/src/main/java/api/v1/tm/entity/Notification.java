package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notifications_recipient_created", columnList = "recipient_id, created_at")
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
