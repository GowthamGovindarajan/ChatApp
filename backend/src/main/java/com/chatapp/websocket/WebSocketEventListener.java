package com.chatapp.websocket;

import com.chatapp.dto.MessageDTO;
import com.chatapp.dto.UserDTO;
import com.chatapp.model.ChatMessage.MessageType;
import com.chatapp.service.ChatMessageService;
import com.chatapp.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * WebSocketEventListener – listens for low-level WebSocket lifecycle events.
 *
 * When a client disconnects (browser closed, network drop, etc.) this listener
 * fires, marks the user offline, and broadcasts a LEAVE message.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserService           userService;
    private final ChatMessageService    chatMessageService;

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        log.info("WebSocket disconnect event for session '{}'", sessionId);

        // Resolve the user from the session ID and mark offline
        UserDTO disconnectedUser = userService.disconnectUser(sessionId);

        if (disconnectedUser != null) {
            String username = disconnectedUser.getUsername();
            log.info("User '{}' disconnected and marked offline", username);

            // Persist LEAVE system message
            MessageDTO leaveMessage = chatMessageService
                    .saveSystemMessage(username, MessageType.LEAVE);

            // Broadcast the LEAVE event to all subscribers
            messagingTemplate.convertAndSend("/topic/public", leaveMessage);

            // Broadcast updated online-user list
            messagingTemplate.convertAndSend(
                    "/topic/users",
                    userService.getOnlineUsers());
        }
    }
}