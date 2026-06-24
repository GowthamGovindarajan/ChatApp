package com.chatapp.controller;

import com.chatapp.dto.MessageDTO;
import com.chatapp.service.ChatMessageService;
import com.chatapp.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ChatController – REST endpoints for chat history.
 *
 * Base path: /api/chat
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageService chatMessageService;
    private final UserService        userService;

    /**
     * GET /api/chat/history
     * Returns the last 50 public messages (loaded on page open).
     */
    @GetMapping("/history")
    public ResponseEntity<List<MessageDTO>> getPublicHistory() {
        return ResponseEntity.ok(chatMessageService.getPublicHistory());
    }

    /**
     * GET /api/chat/private/{username1}/{username2}
     * Returns the private conversation between two users.
     */
    @GetMapping("/private/{username1}/{username2}")
    public ResponseEntity<List<MessageDTO>> getPrivateConversation(
            @PathVariable String username1,
            @PathVariable String username2) {

        Long id1 = userService.getUserByUsername(username1).getId();
        Long id2 = userService.getUserByUsername(username2).getId();

        return ResponseEntity.ok(
                chatMessageService.getPrivateConversation(id1, id2));
    }
}