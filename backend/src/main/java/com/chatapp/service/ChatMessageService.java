package com.chatapp.service;

import com.chatapp.dto.MessageDTO;
import com.chatapp.exception.BadRequestException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.ChatMessage;
import com.chatapp.model.ChatMessage.MessageType;
import com.chatapp.model.User;
import com.chatapp.repository.ChatMessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * ChatMessageService – handles saving, retrieving, and mapping chat messages.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMessageService {

    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    // ── Save ──────────────────────────────────────────────────────────────

    /** Persist a public message and return the saved DTO */
    @Transactional
    public MessageDTO savePublicMessage(MessageDTO dto) {
        User sender = findUser(dto.getSenderUsername());

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .content(sanitize(dto.getContent()))
                .type(MessageType.PUBLIC)
                .build();

        return toDTO(messageRepository.save(message));
    }

    /** Persist a private (direct) message */
    @Transactional
    public MessageDTO savePrivateMessage(MessageDTO dto) {
        if (dto.getReceiverUsername() == null || dto.getReceiverUsername().isBlank()) {
            throw new BadRequestException("Receiver username is required for private messages");
        }

        User sender   = findUser(dto.getSenderUsername());
        User receiver = findUser(dto.getReceiverUsername());

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .receiver(receiver)
                .content(sanitize(dto.getContent()))
                .type(MessageType.PRIVATE)
                .build();

        return toDTO(messageRepository.save(message));
    }

    /** Persist a system event (JOIN / LEAVE) */
    @Transactional
    public MessageDTO saveSystemMessage(String username, MessageType type) {
        User user = findUser(username);

        String content = type == MessageType.JOIN
                ? username + " joined the chat 👋"
                : username + " left the chat";

        ChatMessage message = ChatMessage.builder()
                .sender(user)
                .content(content)
                .type(type)
                .build();

        return toDTO(messageRepository.save(message));
    }

    // ── Retrieve ──────────────────────────────────────────────────────────

    /** Last 50 public messages (used for chat history on page load) */
    public List<MessageDTO> getPublicHistory() {
        return messageRepository.findTop50ByTypeOrderBySentAtAsc(MessageType.PUBLIC)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Full private conversation between two users */
    public List<MessageDTO> getPrivateConversation(Long userId1, Long userId2) {
        return messageRepository.findPrivateConversation(userId1, userId2)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    /** Basic content sanitisation – trim whitespace */
    private String sanitize(String content) {
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Message content cannot be empty");
        }
        return content.trim();
    }

    public MessageDTO toDTO(ChatMessage m) {
        return MessageDTO.builder()
                .id(m.getId())
                .senderUsername(m.getSender().getUsername())
                .receiverUsername(m.getReceiver() != null ? m.getReceiver().getUsername() : null)
                .content(m.getContent())
                .type(m.getType())
                .sentAt(m.getSentAt())
                .read(m.isRead())
                .build();
    }
}