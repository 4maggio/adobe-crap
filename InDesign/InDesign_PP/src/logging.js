/**
 * Logging Module
 * Provides centralized logging functionality for the plugin
 * @module logging
 */

/**
 * Creates a logger instance for managing log messages
 * @param {Object} options - Configuration options
 * @param {number} options.logLimit - Maximum number of log entries to keep (default: 2000)
 * @returns {Object} Logger object with append, clear, and formatting methods
 */
function createLogger({ logLimit = 2000 } = {}) {
    const logBuffer = [];
    let logAutoScrollEnabled = true;
    let pendingFlush = false;

    function getLogElement() {
        return document.getElementById("log-output") || document.querySelector("#log-output");
    }

    /**
     * Flushes buffered logs to the DOM
     * @returns {boolean} True if successful, false if log element not found
     */
    function flushToDom() {
        const logEl = getLogElement();
        if (!logEl) return false;

        let prevScrollTop = 0;
        try {
            prevScrollTop = logEl.scrollTop;
        } catch (_) {
            // ignore
        }

        const text = logBuffer.join("\n");
        logEl.textContent = text;

        try {
            if (logAutoScrollEnabled) logEl.scrollTop = logEl.scrollHeight;
            else logEl.scrollTop = prevScrollTop;
        } catch (_) {
            // ignore
        }

        return true;
    }

    /**
     * Appends a message to the log
     * @param {string} message - Message to log
     */
    function appendLog(message) {
        const ts = new Date().toLocaleTimeString();
        logBuffer.push(`[${ts}] ${message}`);
        if (logBuffer.length > logLimit) {
            logBuffer.shift();
        }
        if (!flushToDom() && !pendingFlush) {
            pendingFlush = true;
            try {
                requestAnimationFrame(() => {
                    pendingFlush = false;
                    flushToDom();
                });
            } catch (_) {
                setTimeout(() => {
                    pendingFlush = false;
                    flushToDom();
                }, 0);
            }
        }
    }

    /**
     * Clears the log buffer and DOM
     */
    function clearLog() {
        logBuffer.length = 0;
        const logEl = getLogElement();
        if (logEl) logEl.textContent = "Log geleert.";
        logAutoScrollEnabled = true;
    }

    /**
     * Sets whether logs automatically scroll to bottom
     * @param {boolean} enabled - Enable/disable auto-scroll
     */
    function setAutoScrollEnabled(enabled) {
        logAutoScrollEnabled = !!enabled;
    }

    /**
     * Checks if auto-scroll is enabled
     * @returns {boolean} Auto-scroll enabled state
     */
    function isAutoScrollEnabled() {
        return logAutoScrollEnabled;
    }

    /**
     * Gets the number of log entries in buffer
     * @returns {number} Number of log entries
     */
    function getBufferLength() {
        return logBuffer.length;
    }

    /**
     * Gets the full log text
     * @returns {string} All log entries joined by newlines
     */
    function getBufferText() {
        return logBuffer.join("\n");
    }

    return {
        appendLog,
        clearLog,
        flushToDom,
        setAutoScrollEnabled,
        isAutoScrollEnabled,
        getBufferLength,
        getBufferText
    };
}

module.exports = {
    createLogger
};
