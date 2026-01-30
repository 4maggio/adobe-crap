function createLogger({ logLimit = 2000 } = {}) {
    const logBuffer = [];
    let logAutoScrollEnabled = true;
    let pendingFlush = false;

    function getLogElement() {
        return document.getElementById("log-output") || document.querySelector("#log-output");
    }

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

    function clearLog() {
        logBuffer.length = 0;
        const logEl = getLogElement();
        if (logEl) logEl.textContent = "Log geleert.";
        logAutoScrollEnabled = true;
    }

    function setAutoScrollEnabled(enabled) {
        logAutoScrollEnabled = !!enabled;
    }

    function isAutoScrollEnabled() {
        return logAutoScrollEnabled;
    }

    function getBufferLength() {
        return logBuffer.length;
    }

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
