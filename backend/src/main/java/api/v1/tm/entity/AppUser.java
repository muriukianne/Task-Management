package api.v1.tm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Table(
    name = "app_users",
    indexes = {
        @Index(name = "idx_app_users_clerk_id", columnList = "clerk_id", unique = true),
        @Index(name = "idx_app_users_email", columnList = "email", unique = true)
    }
)
@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AppUser {

    /** Immutable internal primary key — used for all task FK joins. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /**
     * Clerk JWT {@code sub}. Null until the invited user accepts and logs in.
     * Never used as a foreign key on other tables.
     */
    @Column(name = "clerk_id", length = 255, unique = true)
    private String clerkId;

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
