package com.chatapp.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The user who sent this message
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    // null means public/broadcast; set for private (DM) messages
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id")
    private User receiver;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    // PUBLIC = broadcast, PRIVATE = direct message, JOIN/LEAVE = system events
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageType type;

    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;

    @PrePersist
    protected void onCreate() {
        sentAt = LocalDateTime.now();
    }

    // ── Message type enum ────────────────────────────────────────────────
    public enum MessageType {
        PUBLIC,   // Visible to everyone in the chat room
        PRIVATE,  // Direct message between two users
        JOIN,     // System notification: user joined
        LEAVE     // System notification: user disconnected
    }
}