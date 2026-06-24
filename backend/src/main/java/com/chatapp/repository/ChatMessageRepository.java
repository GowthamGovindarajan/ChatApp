package com.chatapp.repository;

import com.chatapp.model.ChatMessage;
import com.chatapp.model.ChatMessage.MessageType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** Fetch all public messages ordered by time (chat history) */
    List<ChatMessage> findByTypeOrderBySentAtAsc(MessageType type);

    /**
     * Fetch the full private conversation between two users.
     * The JPQL query matches both directions (A→B and B→A).
     */
    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.type = 'PRIVATE'
          AND (
               (m.sender.id = :userId1 AND m.receiver.id = :userId2)
            OR (m.sender.id = :userId2 AND m.receiver.id = :userId1)
          )
        ORDER BY m.sentAt ASC
        """)
    List<ChatMessage> findPrivateConversation(
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2);

    /** Fetch last N public messages for initial load */
    List<ChatMessage> findTop50ByTypeOrderBySentAtAsc(MessageType type);
}