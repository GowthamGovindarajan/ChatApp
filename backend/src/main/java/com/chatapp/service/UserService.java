package com.chatapp.service;

import com.chatapp.dto.UserDTO;
import com.chatapp.exception.BadRequestException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * UserService – all business logic related to user registration,
 * session management, and online-status tracking.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;

    // ── Join / Login ──────────────────────────────────────────────────────

    /**
     * Register a new user OR mark an existing user as online.
     * Associates the WebSocket session ID so disconnect events can be resolved.
     */
    @Transactional
    public UserDTO joinUser(String username, String sessionId) {
        if (username == null || username.isBlank()) {
            throw new BadRequestException("Username cannot be blank");
        }

        User user = userRepository.findByUsername(username.trim())
                .orElseGet(() -> {
                    log.info("New user registered: {}", username);
                    return User.builder()
                            .username(username.trim())
                            .build();
                });

        user.setOnline(true);
        user.setSessionId(sessionId);
        userRepository.save(user);

        log.info("User '{}' joined with session '{}'", username, sessionId);
        return toDTO(user);
    }

    // ── Disconnect ────────────────────────────────────────────────────────

    /**
     * Mark a user offline when their WebSocket session disconnects.
     *
     * @param sessionId the STOMP/WebSocket session ID
     * @return the UserDTO of the disconnected user, or null if not found
     */
    @Transactional
    public UserDTO disconnectUser(String sessionId) {
        return userRepository.findBySessionId(sessionId)
                .map(user -> {
                    user.setOnline(false);
                    user.setSessionId(null);
                    userRepository.save(user);
                    log.info("User '{}' disconnected", user.getUsername());
                    return toDTO(user);
                })
                .orElse(null);
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /** Return all users currently marked as online */
    public List<UserDTO> getOnlineUsers() {
        return userRepository.findByOnlineTrue()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /** Return all users (online and offline) */
    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /** Lookup a user by username, throw 404 if not found */
    public UserDTO getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(this::toDTO)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + username));
    }

    // ── Mapper ────────────────────────────────────────────────────────────

    public UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .online(user.isOnline())
                .joinedAt(user.getJoinedAt())
                .lastSeen(user.getLastSeen())
                .build();
    }
}