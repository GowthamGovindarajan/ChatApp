package com.chatapp.repository;

import com.chatapp.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** Find a user by their unique username (case-sensitive) */
    Optional<User> findByUsername(String username);

    /** Find a user by their active WebSocket session ID */
    Optional<User> findBySessionId(String sessionId);

    /** Return all users who are currently connected */
    List<User> findByOnlineTrue();

    /** Check if a username is already taken */
    boolean existsByUsername(String username);
}