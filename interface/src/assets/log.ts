// ==========================================
// log.ts — Enhanced Web3 Toast Notification
// ==========================================

type LogType = "success" | "error" | "info";

const LOG_META: Record<LogType, { icon: string; title: string }> = {
    success: { icon: "check_circle", title: "Confirmed" },
    error: { icon: "error_outline", title: "Transaction Alert" },
    info: { icon: "auto_awesome", title: "Protocol Status" },
};

export const showLog = (message: string, type: LogType = "info") => {
    const logContainer = document.getElementById("log-messages");
    if (!logContainer) return;

    const meta = LOG_META[type] || LOG_META.info;

    const logEl = document.createElement("div");
    logEl.classList.add("log-message", type);

    logEl.innerHTML = `
        <div class="log-icon-badge">
            <span class="material-icons-round" style="font-size: 18px;">${meta.icon}</span>
        </div>
        <div class="log-content-col">
            <span class="log-title-row">${meta.title}</span>
            <span class="log-text-body"></span>
        </div>
        <button class="log-close-btn" aria-label="Dismiss">
            <span class="material-icons-round" style="font-size: 16px;">close</span>
        </button>
        <div class="log-progress-bar"></div>
    `;

    const textBody = logEl.querySelector(".log-text-body") as HTMLElement;
    if (textBody) textBody.innerText = message;

    const removeToast = () => {
        if (logEl.classList.contains("removing")) return;
        logEl.classList.add("removing");
        logEl.addEventListener("animationend", () => logEl.remove());
    };

    const closeBtn = logEl.querySelector(".log-close-btn");
    closeBtn?.addEventListener("click", removeToast);

    logContainer.appendChild(logEl);

    setTimeout(removeToast, 5000);
};
