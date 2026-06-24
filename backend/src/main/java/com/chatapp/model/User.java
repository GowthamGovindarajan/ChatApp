package com.chatapp.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Username is required")
    @Size(min = 2, max = 50, message = "Username must be 2–50 characters")
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    @Builder.Default
    private boolean online = false;

    @Column(name = "session_id")
    private String sessionId;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "last_seen")
    private LocalDateTime lastSeen;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
        lastSeen = joinedAt;
    }

    @PreUpdate
    protected void onUpdate() {
        lastSeen = LocalDateTime.now();
    }
}