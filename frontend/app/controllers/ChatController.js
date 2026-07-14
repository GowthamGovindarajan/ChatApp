/**
 * ChatController – the main UI controller.
 *
 * Wires together ApiService + WebSocketService and drives all DOM updates:
 *  - Login / logout
 *  - Rendering messages and system events
 *  - Maintaining the online-users sidebar
 *  - Switching between public chat and DM threads
 */
const ChatController = (() => {

    // ── State ─────────────────────────────────────────────────────────────
    let currentUser      = null;   // UserDTO from backend
    let activeChat       = 'PUBLIC';  // 'PUBLIC' or a username string
    let onlineUsers      = [];
    let dmHistory        = {};     // { username: MessageDTO[] }
    let typingTimer      = null;
    let lastRenderedDate = null;

    // ── DOM refs ──────────────────────────────────────────────────────────
    const els = {
        loginScreen:    () => document.getElementById('login-screen'),
        chatScreen:     () => document.getElementById('chat-screen'),
        usernameInput:  () => document.getElementById('username-input'),
        loginError:     () => document.getElementById('login-error'),
        joinBtn:        () => document.getElementById('join-btn'),
        messagesList:   () => document.getElementById('messages-list'),
        messageInput:   () => document.getElementById('message-input'),
        sendBtn:        () => document.getElementById('send-btn'),
        onlineList:     () => document.getElementById('online-users-list'),
        onlineCount:    () => document.getElementById('online-count'),
        dmList:         () => document.getElementById('dm-list'),
        sidebarUsername:() => document.getElementById('sidebar-username'),
        sidebarAvatar:  () => document.getElementById('sidebar-avatar'),
        chatTitle:      () => document.getElementById('chat-header-title'),
        chatSubtitle:   () => document.getElementById('chat-header-subtitle'),
        chatIcon:       () => document.getElementById('chat-header-icon'),
        connStatus:     () => document.getElementById('connection-status'),
        charCounter:    () => document.getElementById('char-counter'),
        messagesContainer: () => document.getElementById('messages-container')
    };

    // ════════════════════════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════════════════════════

    function init() {
        _bindLoginEvents();
        _bindMessageInputEvents();

        // If user refreshed the page, restore session
        const saved = sessionStorage.getItem('chatapp_username');
        if (saved) _autoLogin(saved);
    }

    async function _autoLogin(username) {
        try {
            const user = await ApiService.joinUser(username);
            _startSession(user);
        } catch (e) {
            sessionStorage.removeItem('chatapp_username');
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // LOGIN
    // ════════════════════════════════════════════════════════════════════

    function _bindLoginEvents() {
        els.joinBtn().addEventListener('click', _handleJoin);
        els.usernameInput().addEventListener('keydown', (e) => {
            if (e.key === 'Enter') _handleJoin();
        });
    }

    async function _handleJoin() {
        const username = els.usernameInput().value.trim();
        _clearLoginError();

        if (!username) return _showLoginError('Please enter a username.');
        if (username.length < 2) return _showLoginError('Username must be at least 2 characters.');
        if (username.length > 50) return _showLoginError('Username must be 50 characters or fewer.');

        els.joinBtn().disabled = true;
        els.joinBtn().innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Joining…';

        try {
            const user = await ApiService.joinUser(username);
            sessionStorage.setItem('chatapp_username', username);
            _startSession(user);
        } catch (err) {
            _showLoginError(err.message || 'Failed to join. Is the server running?');
            els.joinBtn().disabled = false;
            els.joinBtn().innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Join Chat';
        }
    }

    function _showLoginError(msg) {
        const el = els.loginError();
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function _clearLoginError() {
        els.loginError().classList.add('hidden');
    }

    // ════════════════════════════════════════════════════════════════════
    // SESSION START
    // ════════════════════════════════════════════════════════════════════

    async function _startSession(user) {
        currentUser = user;

        // Update sidebar
        els.sidebarUsername().textContent = user.username;
        els.sidebarAvatar().textContent   = user.username[0].toUpperCase();

        // Show chat screen
        els.loginScreen().classList.add('hidden');
        els.chatScreen().classList.remove('hidden');

        // Load chat history via REST
        try {
            const history = await ApiService.getChatHistory();
            history.forEach(msg => _renderMessage(msg, false));
            _scrollToBottom(false);
        } catch (e) {
            console.warn('Could not load chat history:', e);
        }

        // Load user list
        try {
            const users = await ApiService.getAllUsers();
            _renderDmList(users);
        } catch (e) { /* non-fatal */ }

        // Connect WebSocket
        _setupWebSocket();
    }

    // ════════════════════════════════════════════════════════════════════
    // WEBSOCKET WIRING
    // ════════════════════════════════════════════════════════════════════

    function _setupWebSocket() {
        _setConnectionStatus('connecting');

        WebSocketService.on('onConnect',        _onWsConnect);
        WebSocketService.on('onDisconnect',     _onWsDisconnect);
        WebSocketService.on('onPublicMessage',  _onPublicMessage);
        WebSocketService.on('onPrivateMessage', _onPrivateMessage);
        WebSocketService.on('onUsersUpdate',    _onUsersUpdate);
        WebSocketService.on('onError',          _onWsError);

        WebSocketService.connect(currentUser.username);
    }

    function _onWsConnect() {
        _setConnectionStatus('connected');
        console.log('[App] WebSocket connected');
    }

    function _onWsDisconnect() {
        _setConnectionStatus('error');
    }

    function _onWsError() {
        _setConnectionStatus('error');
    }

    function _onPublicMessage(msg) {
        if (activeChat === 'PUBLIC') {
            _renderMessage(msg, true);
        }
    }

    function _onPrivateMessage(msg) {
        const otherUser = msg.senderUsername === currentUser.username
            ? msg.receiverUsername
            : msg.senderUsername;

        // Store in dm history
        if (!dmHistory[otherUser]) dmHistory[otherUser] = [];
        dmHistory[otherUser].push(msg);

        if (activeChat === otherUser) {
            _renderMessage(msg, true);
        } else {
            _updateDmBadge(otherUser);
        }
    }

    function _onUsersUpdate(users) {
        onlineUsers = users;
        _renderOnlineUsers(users);
        _renderDmList(users);
    }

    // ════════════════════════════════════════════════════════════════════
    // SEND MESSAGE
    // ════════════════════════════════════════════════════════════════════

    function _bindMessageInputEvents() {
        els.sendBtn().addEventListener('click', _handleSend);
        els.messageInput().addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _handleSend();
            }
        });

        // Auto-resize textarea + char counter
        els.messageInput().addEventListener('input', () => {
            const ta = els.messageInput();
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

            const len = ta.value.length;
            const counter = els.charCounter();
            counter.textContent = `${len} / 1000`;
            counter.className = 'char-counter' +
                (len > 900 ? ' danger' : len > 800 ? ' warning' : '');

            // Update input placeholder to reflect current channel
            const ph = activeChat === 'PUBLIC'
                ? 'Message #general'
                : `Message @${activeChat}`;
            ta.placeholder = ph;
        });
    }

    function _handleSend() {
        const content = els.messageInput().value.trim();
        if (!content || !WebSocketService.isConnected()) return;

        try {
            if (activeChat === 'PUBLIC') {
                WebSocketService.sendPublicMessage(currentUser.username, content);
            } else {
                WebSocketService.sendPrivateMessage(
                    currentUser.username, activeChat, content);
            }
            // Clear input
            const ta = els.messageInput();
            ta.value = '';
            ta.style.height = 'auto';
            els.charCounter().textContent = '0 / 1000';
        } catch (err) {
            console.error('Send failed:', err);
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // RENDER MESSAGES
    // ════════════════════════════════════════════════════════════════════

    function _renderMessage(msg, animate) {
        const list = els.messagesList();

        // Date divider
        const msgDate = msg.sentAt
            ? new Date(msg.sentAt).toLocaleDateString()
            : new Date().toLocaleDateString();

        if (msgDate !== lastRenderedDate) {
            lastRenderedDate = msgDate;
            const div = document.createElement('div');
            div.className = 'date-divider';
            div.textContent = _formatDate(msg.sentAt);
            list.appendChild(div);
        }

        const el = document.createElement('div');

        // ── System message (JOIN / LEAVE) ─────────────────────────────────
        if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
            el.className = 'message system';
            const icon = msg.type === 'JOIN' ? '👋' : '👋';
            el.innerHTML = `<div class="system-message">
                ${msg.type === 'JOIN' ? '🟢' : '🔴'}
                ${_esc(msg.content || msg.senderUsername + (msg.type === 'JOIN' ? ' joined' : ' left'))}
            </div>`;
            list.appendChild(el);
            if (animate) _scrollToBottom(true);
            return;
        }

        // ── Chat bubble ───────────────────────────────────────────────────
        const isMine = msg.senderUsername === currentUser.username;
        el.className = `message ${isMine ? 'sent' : 'received'}`;
        if (!animate) el.style.animation = 'none';

        const initial = msg.senderUsername ? msg.senderUsername[0].toUpperCase() : '?';
        const timeStr = msg.sentAt ? _formatTime(msg.sentAt) : '';

        el.innerHTML = `
            <div class="message-avatar">${initial}</div>
            <div class="message-content">
                ${!isMine ? `<span class="message-sender">${_esc(msg.senderUsername)}</span>` : ''}
                <div class="message-bubble">${_esc(msg.content)}</div>
                <span class="message-time">${timeStr}</span>
            </div>`;

        list.appendChild(el);
        if (animate) _scrollToBottom(true);
    }

    function _scrollToBottom(smooth) {
        const container = els.messagesContainer();
        container.scrollTo({
            top: container.scrollHeight,
            behavior: smooth ? 'smooth' : 'instant'
        });
    }

    // ════════════════════════════════════════════════════════════════════
    // ONLINE USERS + DM LIST
    // ════════════════════════════════════════════════════════════════════

    function _renderOnlineUsers(users) {
        const list = els.onlineList();
        els.onlineCount().textContent = users.length;
        list.innerHTML = '';

        users.forEach(u => {
            const li = document.createElement('li');
            li.className = 'online-user-item';
            li.innerHTML = `
                <div class="online-user-avatar">${u.username[0].toUpperCase()}</div>
                <span class="online-user-name ${u.username === currentUser.username ? 'is-me' : ''}">
                    ${_esc(u.username)}${u.username === currentUser.username ? ' (you)' : ''}
                </span>`;
            li.addEventListener('click', () => switchToDM(u.username));
            list.appendChild(li);
        });
    }

    function _renderDmList(users) {
        const list = els.dmList();
        list.innerHTML = '';

        users
            .filter(u => u.username !== currentUser.username)
            .forEach(u => {
                const li = document.createElement('li');
                li.className = `dm-item${activeChat === u.username ? ' active' : ''}`;
                li.id = `dm-item-${u.username}`;
                li.innerHTML = `
                    <div class="user-avatar-sm">${u.username[0].toUpperCase()}</div>
                    <span>${_esc(u.username)}</span>
                    <span class="user-status-dot ${u.online ? 'online' : 'offline'}"></span>
                    <span id="badge-${u.username}" class="unread-badge hidden">●</span>`;
                li.addEventListener('click', () => switchToDM(u.username));
                list.appendChild(li);
            });
    }

    function _updateDmBadge(username) {
        const badge = document.getElementById(`badge-${username}`);
        if (badge) badge.classList.remove('hidden');
    }

    // ════════════════════════════════════════════════════════════════════
    // CHANNEL SWITCHING
    // ════════════════════════════════════════════════════════════════════

    function switchToPublic() {
        activeChat = 'PUBLIC';
        els.chatTitle().textContent    = 'general';
        els.chatSubtitle().textContent = 'Team chat room';
        els.chatIcon().innerHTML = '<i class="fa-solid fa-hashtag"></i>';
        els.messageInput().placeholder = 'Message #general';

        // Clear active state on DM items
        document.querySelectorAll('.dm-item').forEach(i => i.classList.remove('active'));
        document.getElementById('public-channel-btn').classList.add('active');

        // Reload public history
        _clearMessages();
        ApiService.getChatHistory().then(history => {
            history.forEach(msg => _renderMessage(msg, false));
            _scrollToBottom(false);
        });
    }

    async function switchToDM(username) {
        if (username === currentUser.username) return;
        activeChat = username;

        els.chatTitle().textContent    = username;
        els.chatSubtitle().textContent = 'Direct message';
        els.chatIcon().innerHTML = '<i class="fa-solid fa-at"></i>';
        els.messageInput().placeholder = `Message @${username}`;

        // Update sidebar active states
        document.getElementById('public-channel-btn').classList.remove('active');
        document.querySelectorAll('.dm-item').forEach(i => i.classList.remove('active'));
        const dmItem = document.getElementById(`dm-item-${username}`);
        if (dmItem) dmItem.classList.add('active');

        // Clear unread badge
        const badge = document.getElementById(`badge-${username}`);
        if (badge) badge.classList.add('hidden');

        // Load DM history
        _clearMessages();
        try {
            const history = await ApiService.getPrivateConversation(
                currentUser.username, username);
            dmHistory[username] = history;
            history.forEach(msg => _renderMessage(msg, false));
            _scrollToBottom(false);
        } catch (e) {
            console.warn('DM history failed:', e);
        }
    }

    function _clearMessages() {
        els.messagesList().innerHTML = '';
        lastRenderedDate = null;
    }

    // ════════════════════════════════════════════════════════════════════
    // LOGOUT
    // ════════════════════════════════════════════════════════════════════

    function logout() {
        WebSocketService.disconnect();
        sessionStorage.removeItem('chatapp_username');
        currentUser = null;
        activeChat  = 'PUBLIC';
        dmHistory   = {};

        els.messagesList().innerHTML = '';
        els.chatScreen().classList.add('hidden');
        els.loginScreen().classList.remove('hidden');
        els.usernameInput().value = '';
    }

    // ════════════════════════════════════════════════════════════════════
    // CONNECTION STATUS
    // ════════════════════════════════════════════════════════════════════

    function _setConnectionStatus(state) {
        const el = els.connStatus();
        const labels = {
            connecting: '<i class="fa-solid fa-circle"></i> Connecting…',
            connected:  '<i class="fa-solid fa-circle"></i> Connected',
            error:      '<i class="fa-solid fa-circle"></i> Reconnecting…'
        };
        el.className = `connection-badge ${state}`;
        el.innerHTML = labels[state] || labels.connecting;
    }

    // ════════════════════════════════════════════════════════════════════
    // UTILITY
    // ════════════════════════════════════════════════════════════════════

    /** Escape HTML to prevent XSS */
    function _esc(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;')
                  .replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;');
    }

    /** Format ISO timestamp to HH:MM */
    function _formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /** Format date for divider */
    function _formatDate(iso) {
        if (!iso) return 'Today';
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });
    }

    // ── Public API ────────────────────────────────────────────────────────
    return { init, switchToPublic, switchToDM, logout };

})();