package com.chatapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * LoginRequest – payload sent by the client when joining the chat.
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Username cannot be blank")
    @Size(min = 2, max = 50, message = "Username must be 2–50 characters")
    private String username;
}