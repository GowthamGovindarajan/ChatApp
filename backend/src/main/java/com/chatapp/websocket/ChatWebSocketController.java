package com.chatapp.websocket;

import com.chatapp.dto.MessageDTO;
import com.chatapp.model.ChatMessage.MessageType;
import com.chatapp.service.ChatMessageService;
import com.chatapp.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * ChatWebSocketController – handles all inbound STOMP frames.
 *
 * Destinations handled:
 *   /app/chat.sendMessage  → broadcast to /topic/public
 *   /app/chat.addUser      → register session + broadcast JOIN event
 *   /app/chat.private      → route to /user/{username}/queue/private
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatMessageService    chatMessageService;
    private final UserService           userService;

    // ── Public Message ────────────────────────────────────────────────────

    /**
     * Client sends to /app/chat.sendMessage
     * Server broadcasts the saved message to all subscribers of /topic/public
     */
    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public MessageDTO sendPublicMessage(@Payload MessageDTO messageDTO) {
        log.debug("Public message from '{}'", messageDTO.getSenderUsername());
        return chatMessageService.savePublicMessage(messageDTO);
    }

    // ── User Join ─────────────────────────────────────────────────────────

    /**
     * Client sends to /app/chat.addUser immediately after connecting.
     * We store the session so we can resolve disconnects later.
     */
    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public MessageDTO addUser(@Payload MessageDTO messageDTO,
                              SimpMessageHeaderAccessor headerAccessor) {

        String sessionId = headerAccessor.getSessionId();
        log.info("User '{}' joining, session '{}'", messageDTO.getSenderUsername(), sessionId);

        // Register / update user in DB
        userService.joinUser(messageDTO.getSenderUsername(), sessionId);

        // Store username in WebSocket session attributes for use at disconnect
        headerAccessor.getSessionAttributes()
                .put("username", messageDTO.getSenderUsername());

        // Broadcast updated online user list
        broadcastOnlineUsers();

        // Persist and return the JOIN event to the public topic
        return chatMessageService.saveSystemMessage(
                messageDTO.getSenderUsername(), MessageType.JOIN);
    }

    // ── Private (Direct) Message ──────────────────────────────────────────

    /**
     * Client sends to /app/chat.private
     * Message is delivered only to the target user's private queue.
     */
    @MessageMapping("/chat.private")
    public void sendPrivateMessage(@Payload MessageDTO messageDTO) {
        log.debug("Private message from '{}' to '{}'",
                messageDTO.getSenderUsername(), messageDTO.getReceiverUsername());

        MessageDTO saved = chatMessageService.savePrivateMessage(messageDTO);

        // Deliver to receiver's private queue
        messagingTemplate.convertAndSendToUser(
                messageDTO.getReceiverUsername(),
                "/queue/private",
                saved);

        // Also echo back to sender so they see their own message
        messagingTemplate.convertAndSendToUser(
                messageDTO.getSenderUsername(),
                "/queue/private",
                saved);
    }

    // ── Helper ────────────────────────────────────────────────────────────

    /** Push the latest online-user list to all clients */
    private void broadcastOnlineUsers() {
        messagingTemplate.convertAndSend(
                "/topic/users",
                userService.getOnlineUsers());
    }
}