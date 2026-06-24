package com.chatapp.dto;

import com.chatapp.model.ChatMessage.MessageType;
import lombok.*;
import java.time.LocalDateTime;

/**
 * MessageDTO – the object that travels over WebSocket and REST.
 * Keeps the wire format clean and decoupled from the JPA entity.
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MessageDTO {

    private Long id;
    private String senderUsername;
    private String receiverUsername;  // null for public messages
    private String content;
    private MessageType type;
    private LocalDateTime sentAt;
    private boolean read;
}