package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Table(name = "app_users")
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AppUser {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
