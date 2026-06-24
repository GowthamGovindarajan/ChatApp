/**
 * app.js – application entry point.
 * Bootstraps ChatController once the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[ChatApp] Initialising…');
    ChatController.init();
});