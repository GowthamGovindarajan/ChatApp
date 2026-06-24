package com.chatapp.controller;

import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.UserDTO;
import com.chatapp.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * UserController – REST endpoints for user management.
 *
 * Base path: /api/users
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * POST /api/users/join
     * Registers a new user or marks an existing one online.
     * Called by the frontend before the WebSocket connection is opened.
     */
    @PostMapping("/join")
    public ResponseEntity<UserDTO> joinUser(@Valid @RequestBody LoginRequest request) {
        // sessionId is null here; it will be updated once the WS handshake completes
        UserDTO user = userService.joinUser(request.getUsername(), null);
        return ResponseEntity.ok(user);
    }

    /**
     * GET /api/users/online
     * Returns all users currently connected.
     */
    @GetMapping("/online")
    public ResponseEntity<List<UserDTO>> getOnlineUsers() {
        return ResponseEntity.ok(userService.getOnlineUsers());
    }

    /**
     * GET /api/users
     * Returns all users (for the sidebar user list).
     */
    @GetMapping
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /**
     * GET /api/users/{username}
     * Returns a single user's profile.
     */
    @GetMapping("/{username}")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }

    /**
     * GET /api/users/check/{username}
     * Quick availability check before registering.
     */
    @GetMapping("/check/{username}")
    public ResponseEntity<Map<String, Boolean>> checkUsername(@PathVariable String username) {
        boolean exists = userService.getAllUsers()
                .stream()
                .anyMatch(u -> u.getUsername().equalsIgnoreCase(username));
        return ResponseEntity.ok(Map.of("exists", exists));
    }
}