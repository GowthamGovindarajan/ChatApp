package com.chatapp.dto;

import lombok.*;
import java.time.LocalDateTime;

/**
 * UserDTO – safe user representation sent over REST/WebSocket.
 * Never exposes internal fields like sessionId.
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class UserDTO {

    private Long id;
    private String username;
    private boolean online;
    private LocalDateTime joinedAt;
    private LocalDateTime lastSeen;
}