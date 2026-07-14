/**
 * WebSocketService – manages the STOMP over SockJS connection.
 *
 * Responsibilities:
 *  - Connect / disconnect lifecycle
 *  - Subscribe to /topic/public, /topic/users, /user/queue/private
 *  - Publish messages to /app/* destinations
 *  - Expose callback hooks so ChatController can react to events
 */
const WebSocketService = (() => {

    const WS_URL = 'http://localhost:8080/ws';  // SockJS endpoint

    let stompClient = null;
    let reconnectTimer = null;
    let reconnectDelay = 3000;   // ms before attempting reconnect
    let connected = false;

    // ── Callback hooks (set by ChatController) ────────────────────────────
    const callbacks = {
        onConnect:       () => {},
        onDisconnect:    () => {},
        onPublicMessage: () => {},
        onPrivateMessage:() => {},
        onUsersUpdate:   () => {},
        onError:         () => {}
    };

    // ── Connect ───────────────────────────────────────────────────────────

    function connect(username) {
        // Tear down any existing connection first
        if (stompClient) disconnect(false);

        const socket = new SockJS(WS_URL);
        stompClient = Stomp.over(socket);

        // Suppress STOMP debug output in production
        stompClient.debug = null;

        stompClient.connect(
            {},                          // headers
            () => _onConnected(username),
            _onError
        );
    }

    function _onConnected(username) {
        connected = true;
        clearTimeout(reconnectTimer);
        reconnectDelay = 3000;  // reset back-off
        console.log('[WS] Connected');

        // ── Subscribe to public topic ─────────────────────────────────────
        stompClient.subscribe('/topic/public', (frame) => {
            const msg = JSON.parse(frame.body);
            callbacks.onPublicMessage(msg);
        });

        // ── Subscribe to user list updates ────────────────────────────────
        stompClient.subscribe('/topic/users', (frame) => {
            const users = JSON.parse(frame.body);
            callbacks.onUsersUpdate(users);
        });

        // ── Subscribe to incoming private messages ────────────────────────
        stompClient.subscribe('/user/queue/private', (frame) => {
            const msg = JSON.parse(frame.body);
            callbacks.onPrivateMessage(msg);
        });

        // ── Announce this user's arrival ──────────────────────────────────
        stompClient.send('/app/chat.addUser', {}, JSON.stringify({
            senderUsername: username,
            type: 'JOIN'
        }));

        callbacks.onConnect();
    }

    function _onError(error) {
        connected = false;
        console.error('[WS] Error:', error);
        callbacks.onError(error);

        // Exponential back-off reconnect (max 30 s)
        reconnectTimer = setTimeout(() => {
            console.log('[WS] Attempting reconnect…');
            const savedUser = sessionStorage.getItem('chatapp_username');
            if (savedUser) connect(savedUser);
        }, Math.min(reconnectDelay *= 1.5, 30000));
    }

    // ── Disconnect ────────────────────────────────────────────────────────

    function disconnect(fireCallback = true) {
        clearTimeout(reconnectTimer);
        if (stompClient) {
            try { stompClient.disconnect(); } catch (e) { /* ignore */ }
            stompClient = null;
        }
        connected = false;
        if (fireCallback) callbacks.onDisconnect();
    }

    // ── Send public message ───────────────────────────────────────────────

    function sendPublicMessage(senderUsername, content) {
        if (!connected) throw new Error('Not connected to WebSocket');
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
            senderUsername,
            content,
            type: 'PUBLIC'
        }));
    }

    // ── Send private (direct) message ─────────────────────────────────────

    function sendPrivateMessage(senderUsername, receiverUsername, content) {
        if (!connected) throw new Error('Not connected to WebSocket');
        stompClient.send('/app/chat.private', {}, JSON.stringify({
            senderUsername,
            receiverUsername,
            content,
            type: 'PRIVATE'
        }));
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function isConnected() { return connected; }

    function on(event, fn) {
        if (callbacks.hasOwnProperty(event)) callbacks[event] = fn;
    }

    // ── Public API ────────────────────────────────────────────────────────
    return {
        connect,
        disconnect,
        sendPublicMessage,
        sendPrivateMessage,
        isConnected,
        on
    };

})();