/**
 * ApiService – wrapper around all REST API calls to the Spring Boot backend.
 * Uses the Fetch API with async/await and centralised error handling.
 */
const ApiService = (() => {

    // ── Base URL – change port if backend runs elsewhere ─────────────────
    const BASE_URL = 'http://localhost:8080/api';

    // ── Internal helper: parse response or throw a meaningful error ───────
    async function handleResponse(response) {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const message = data?.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(message);
        }
        return data;
    }

    // ── POST /api/users/join ──────────────────────────────────────────────
    async function joinUser(username) {
        const response = await fetch(`${BASE_URL}/users/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return handleResponse(response);
    }

    // ── GET /api/users/online ─────────────────────────────────────────────
    async function getOnlineUsers() {
        const response = await fetch(`${BASE_URL}/users/online`);
        return handleResponse(response);
    }

    // ── GET /api/users ────────────────────────────────────────────────────
    async function getAllUsers() {
        const response = await fetch(`${BASE_URL}/users`);
        return handleResponse(response);
    }

    // ── GET /api/chat/history ─────────────────────────────────────────────
    async function getChatHistory() {
        const response = await fetch(`${BASE_URL}/chat/history`);
        return handleResponse(response);
    }

    // ── GET /api/chat/private/{u1}/{u2} ───────────────────────────────────
    async function getPrivateConversation(username1, username2) {
        const response = await fetch(
            `${BASE_URL}/chat/private/${encodeURIComponent(username1)}/${encodeURIComponent(username2)}`
        );
        return handleResponse(response);
    }

    // ── GET /api/users/check/{username} ───────────────────────────────────
    async function checkUsernameExists(username) {
        const response = await fetch(
            `${BASE_URL}/users/check/${encodeURIComponent(username)}`
        );
        return handleResponse(response);  // { exists: boolean }
    }

    // ── Public API ────────────────────────────────────────────────────────
    return {
        joinUser,
        getOnlineUsers,
        getAllUsers,
        getChatHistory,
        getPrivateConversation,
        checkUsernameExists
    };

})();