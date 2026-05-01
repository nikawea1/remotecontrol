// Файл: RemoteControl1/wwwroot/js/timer.js

let bottomTrackerExpanded = false;
let workDayStatusInterval = null;

let idleTimerHandle = null;
let idleListenersBound = false;
let idlePauseInProgress = false;
let currentWorkDayStatus = null;

function getTimerTasks() {
    if (typeof getAvailableTimerTasks === "function") {
        return getAvailableTimerTasks();
    }

    const allTasks = Array.isArray(tasks) ? tasks : [];

    if (!currentUserId || Number(currentUserId) <= 0) {
        return [];
    }

    return allTasks.filter(t => Number(t.userId) === Number(currentUserId));
}

async function startCaptureIfAvailable() {
    if (typeof startScreenshotCapture === "function") {
        await startScreenshotCapture();
    }
}

function stopCaptureIfAvailable() {
    if (typeof stopScreenshotCapture === "function") {
        stopScreenshotCapture();
    }
}

function releaseScreenIfAvailable() {
    if (typeof releaseScreenAccess === "function") {
        releaseScreenAccess();
    }
}

function formatLocalTime(date) {
    return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function normalizeWorkDayEntry(item) {
    return {
        date: item?.date ?? item?.Date ?? "-",
        start: item?.start ?? item?.Start ?? "-",
        end: item?.end ?? item?.End ?? "-",
        hours: Number(item?.hours ?? item?.Hours ?? 0)
    };
}

function formatTimerValue(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:` +
        `${minutes.toString().padStart(2, "0")}:` +
        `${secs.toString().padStart(2, "0")}`;
}

function updateTimerDisplay() {
    const timeString = formatTimerValue(seconds);

    document.querySelectorAll(".timer, #bottomTimer").forEach(timer => {
        timer.textContent = timeString;
    });
}

function updateMiniTrackerButtons() {
    const startBtn = document.getElementById("bottomMiniStart");
    const pauseBtn = document.getElementById("bottomMiniPause");
    const stopBtn = document.getElementById("bottomMiniStop");

    if (!startBtn || !pauseBtn || !stopBtn) return;

    if (!isTracking && !isPaused) {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        return;
    }

    if (isTracking && !isPaused) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        return;
    }

    if (isPaused) {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
    }
}

function updateBottomTrackerUI() {
    const statusText = document.getElementById("statusText");
    const statusDot = document.getElementById("statusDot");

    const bottomMainActionBtn = document.getElementById("bottomMainActionBtn");
    const bottomMainActionIcon = document.getElementById("bottomMainActionIcon");
    const bottomMainActionText = document.getElementById("bottomMainActionText");

    const startBtn = document.getElementById("bottomStartBtn");
    const pauseBtn = document.getElementById("bottomPauseBtn");
    const stopBtn = document.getElementById("bottomStopBtn");

    let state = "stopped";
    let stateText = "Остановлен";

    if (isTracking) {
        state = "active";
        stateText = "Активен";
    } else if (isPaused) {
        state = "paused";
        stateText = "На паузе";
    }

    if (statusText) statusText.textContent = stateText;
    if (statusDot) statusDot.className = `status-dot ${state}`;

    if (bottomMainActionBtn && bottomMainActionIcon && bottomMainActionText) {
        bottomMainActionBtn.classList.remove("start", "pause", "stop");

        if (isTracking) {
            bottomMainActionBtn.classList.add("stop");
            bottomMainActionIcon.className = "fas fa-stop";
            bottomMainActionText.textContent = "Стоп";
        } else if (isPaused) {
            bottomMainActionBtn.classList.add("start");
            bottomMainActionIcon.className = "fas fa-play";
            bottomMainActionText.textContent = "Продолжить";
        } else {
            bottomMainActionBtn.classList.add("start");
            bottomMainActionIcon.className = "fas fa-play";
            bottomMainActionText.textContent = "Старт";
        }
    }

    if (startBtn) startBtn.disabled = isTracking;
    if (pauseBtn) pauseBtn.disabled = !isTracking;
    if (stopBtn) stopBtn.disabled = !isTracking && !isPaused;

    if (bottomMainActionBtn && bottomMainActionIcon) {
        bottomMainActionBtn.disabled = false;

        if (isTracking) {
            bottomMainActionBtn.className = "bottom-main-action";
            bottomMainActionBtn.style.background = "#e53935";
            bottomMainActionIcon.className = "fas fa-stop";
        } else if (isPaused) {
            bottomMainActionBtn.className = "bottom-main-action";
            bottomMainActionBtn.style.background = "#43a047";
            bottomMainActionIcon.className = "fas fa-play";
        } else {
            bottomMainActionBtn.className = "bottom-main-action";
            bottomMainActionBtn.style.background = "var(--primary)";
            bottomMainActionIcon.className = "fas fa-play";
        }
    }

    updateMiniTrackerButtons();
}

function handleBottomMainAction() {
    if (isTracking) {
        stopTracking();
        return;
    }

    if (isPaused) {
        startTracking();
        return;
    }

    startTracking();
}

function toggleBottomTracker() {
    const shell = document.getElementById("bottomTrackerShell");
    if (!shell) return;

    bottomTrackerExpanded = !bottomTrackerExpanded;

    shell.classList.toggle("expanded", bottomTrackerExpanded);
    shell.classList.toggle("collapsed", !bottomTrackerExpanded);
}

function updateTimer() {
    if (!isPaused && isTracking) {
        seconds++;
        updateTimerDisplay();
    }
}

function highlightBottomTracker() {
    const shell = document.getElementById("bottomTrackerShell");
    if (!shell) return;

    shell.classList.remove("attention");
    void shell.offsetWidth;
    shell.classList.add("attention");

    setTimeout(() => {
        shell.classList.remove("attention");
    }, 1600);
}

async function startTracking() {
    let selectedTaskId = activeTaskId;

    const trackerPage = document.getElementById("trackerPage");
    const trackerPageVisible = trackerPage && !trackerPage.classList.contains("hidden");

    if (trackerPageVisible) {
        const select = document.getElementById("currentTaskFull");
        if (select && select.value) {
            selectedTaskId = Number(select.value);
        }
    } else {
        const select = document.getElementById("currentTask");
        if (select && select.value) {
            selectedTaskId = Number(select.value);
        }
    }

    if (!selectedTaskId) {
        showNotification("Выберите задачу для отслеживания");
        return;
    }

    const task = getTimerTasks().find(t => Number(t.id) === Number(selectedTaskId));
    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=StartTaskTimer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ taskId: task.id, comment: "" })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось запустить таймер");
            return;
        }

        setActiveTask(task);

        isTracking = true;
        isPaused = false;

        if (!timerInterval) {
            timerInterval = setInterval(updateTimer, 1000);
        }

        updateBottomTrackerUI();
        highlightBottomTracker();
        showNotification(`Трекер запущен: ${task.name}`);

        await startCaptureIfAvailable();
        resetIdleTimer();
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function pauseTracking(options = {}) {
    const silent = !!options.silent;

    if (!isTracking || isPaused) {
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=PauseTaskTimer", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            if (!silent) {
                showNotification(data?.error || "Не удалось поставить таймер на паузу");
            }
            return;
        }

        isPaused = true;
        isTracking = false;

        clearInterval(timerInterval);
        timerInterval = null;

        const task = getTimerTasks().find(t => Number(t.id) === Number(activeTaskId));
        const taskName = task ? task.name : "Без задачи";

        const entry = {
            date: new Date().toLocaleDateString("ru-RU"),
            task: taskName,
            hours: Number(data.hours || 0),
            comment: "Сессия таймера"
        };

        if (entry.hours > 0) {
            timeEntries.unshift(entry);
        }

        renderActivityLog();
        renderDashboard();
        updateBottomTrackerUI();
        stopCaptureIfAvailable();

        resetIdleTimer();

        if (!silent) {
            showNotification(`Таймер на паузе.\nУчтено: ${entry.hours} ч`);
        }
    } catch {
        if (!silent) {
            showNotification("Ошибка сети/сервера");
        }
    }
}

async function stopTracking() {
    if (!isTracking && !isPaused) {
        return;
    }

    if (isPaused) {
        isPaused = false;
        isTracking = false;
        seconds = 0;
        activeTaskId = null;
        activeTaskName = "";

        clearInterval(timerInterval);
        timerInterval = null;

        updateTimerDisplay();
        renderActivityLog();
        renderDashboard();
        updateBottomTrackerUI();

        stopCaptureIfAvailable();
        releaseScreenIfAvailable();
        resetIdleTimer();

        showNotification("Таймер остановлен");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=StopTaskTimer", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось остановить таймер");
            return;
        }

        const task = getTimerTasks().find(t => Number(t.id) === Number(activeTaskId));
        const taskName = task ? task.name : "Без задачи";

        const entry = {
            date: new Date().toLocaleDateString("ru-RU"),
            task: taskName,
            hours: Number(data.hours || 0),
            comment: "Сессия таймера"
        };

        if (entry.hours > 0) {
            timeEntries.unshift(entry);
        }

        isTracking = false;
        isPaused = false;
        activeTaskId = null;
        activeTaskName = "";
        seconds = 0;

        clearInterval(timerInterval);
        timerInterval = null;

        updateTimerDisplay();
        renderActivityLog();
        renderDashboard();
        updateBottomTrackerUI();

        stopCaptureIfAvailable();
        releaseScreenIfAvailable();
        resetIdleTimer();

        showNotification(`Сессия завершена.\nОтработано: ${entry.hours} ч`);
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function startTracker() {
    try {
        const res = await fetch("/MainPage?handler=StartWorkDay", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось начать рабочий день");
            return;
        }

        isWorkDayStarted = true;

        const startBtn = document.getElementById("startDayBtn");
        const stopBtn = document.getElementById("stopDayBtn");

        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        showNotification("Рабочий день начат");
        await loadWorkDayStatus();

        resetIdleTimer();
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function stopTracker() {
    try {
        const previousStatus = currentWorkDayStatus ? { ...currentWorkDayStatus } : null;

        if (isTracking || isPaused) {
            await stopTracking();
        }

        const res = await fetch("/MainPage?handler=StopWorkDay", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось завершить рабочий день");
            return;
        }

        isWorkDayStarted = false;
        isPaused = false;
        isTracking = false;
        activeTaskId = null;
        activeTaskName = "";
        seconds = 0;

        clearInterval(timerInterval);
        timerInterval = null;

        updateTimerDisplay();
        updateBottomTrackerUI();

        const startBtn = document.getElementById("startDayBtn");
        const stopBtn = document.getElementById("stopDayBtn");

        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");

        stopCaptureIfAvailable();
        releaseScreenIfAvailable();

        if (previousStatus?.startedAt && previousStatus.startedAt !== "--:--") {
            workDays = [
                {
                    date: new Date().toLocaleDateString("ru-RU"),
                    start: previousStatus.startedAt,
                    end: formatLocalTime(new Date()),
                    hours: Number(data.hours || previousStatus.currentHours || 0)
                },
                ...(Array.isArray(workDays) ? workDays : [])
            ];

            renderWorkDayHistory();
        }

        await loadWorkDayStatus();

        resetIdleTimer();
        showNotification(`Рабочий день завершен.\nОтработано: ${data.hours} ч`);
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function addTimeEntry() {
    const requestId = Number(document.getElementById("quickManualRequestId")?.value || "0");
    const taskId = Number(document.getElementById("quickTask")?.value);
    const workDate = document.getElementById("quickWorkDate")?.value || "";
    const hoursRaw = document.getElementById("quickHours")?.value || "0";
    const hours = parseFloat(hoursRaw.replace(",", "."));
    const reason = document.getElementById("quickReason")?.value || "";
    const comment = document.getElementById("quickComment")?.value.trim() || "";
    const fileInput = document.getElementById("quickAttachment");
    const file = fileInput?.files?.[0] || null;
    const existingRequest = requestId > 0 && Array.isArray(window.manualTimeRequests)
        ? window.manualTimeRequests.find(x => Number(x.id) === requestId)
        : null;
    const hasExistingAttachment = Boolean(existingRequest?.attachmentPath);

    if (!taskId || !hours || hours <= 0 || !workDate || !reason) {
        showNotification("Заполните задачу, дату, причину и часы");
        return;
    }

    if (!comment) {
        showNotification("Комментарий к заявке обязателен");
        return;
    }

    if (!file && !hasExistingAttachment) {
        showNotification("Прикрепите файл-подтверждение");
        return;
    }

    try {
        const formData = new FormData();
        formData.append("requestId", String(requestId));
        formData.append("taskId", String(taskId));
        formData.append("workDate", workDate);
        formData.append("hours", String(hours));
        formData.append("reason", reason);
        formData.append("comment", comment);

        if (file) {
            formData.append("file", file);
        }

        const res = await fetch("/MainPage?handler=CreateManualTimeRequest", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось отправить заявку");
            return;
        }

        if (typeof resetQuickManualRequestForm === "function") {
            resetQuickManualRequestForm();
        }

        if (typeof loadManualTimeRequests === "function") {
            loadManualTimeRequests();
        }

        showNotification(requestId > 0 ? "Заявка повторно отправлена на проверку" : "Заявка на ручное время отправлена");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function getCurrentLocalDateForInput() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function startManualRequestEdit(id) {
    const request = Array.isArray(window.manualTimeRequests)
        ? window.manualTimeRequests.find(x => Number(x.id) === Number(id))
        : null;

    if (!request || !request.canResubmit) {
        showNotification("Эту заявку нельзя редактировать");
        return;
    }

    const requestIdField = document.getElementById("quickManualRequestId");
    const taskField = document.getElementById("quickTask");
    const workDateField = document.getElementById("quickWorkDate");
    const hoursField = document.getElementById("quickHours");
    const reasonField = document.getElementById("quickReason");
    const commentField = document.getElementById("quickComment");
    const submitButton = document.getElementById("quickTimeSubmitButton");
    const resetButton = document.getElementById("quickTimeResetButton");

    if (!requestIdField || !taskField || !workDateField || !hoursField || !reasonField || !commentField) {
        showNotification("Форма ручного времени не найдена");
        return;
    }

    requestIdField.value = String(request.id);
    taskField.value = String(request.taskId || "");
    workDateField.value = request.workDateValue || "";
    hoursField.value = String(request.hours || 1);
    reasonField.value = request.reason || "";
    commentField.value = request.comment || "";

    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-rotate-right"></i> Отправить повторно';
    }

    if (resetButton) {
        resetButton.classList.remove("hidden");
    }

    const quickCard = document.getElementById("quickTask");
    if (quickCard) {
        quickCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function resetQuickManualRequestForm() {
    const requestIdField = document.getElementById("quickManualRequestId");
    const taskField = document.getElementById("quickTask");
    const workDateField = document.getElementById("quickWorkDate");
    const hoursField = document.getElementById("quickHours");
    const reasonField = document.getElementById("quickReason");
    const commentField = document.getElementById("quickComment");
    const fileField = document.getElementById("quickAttachment");
    const submitButton = document.getElementById("quickTimeSubmitButton");
    const resetButton = document.getElementById("quickTimeResetButton");

    if (requestIdField) requestIdField.value = "0";
    if (taskField) taskField.value = "";
    if (workDateField) workDateField.value = getCurrentLocalDateForInput();
    if (hoursField) hoursField.value = "1";
    if (reasonField) reasonField.value = "";
    if (commentField) commentField.value = "";
    if (fileField) fileField.value = "";

    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';
    }

    if (resetButton) {
        resetButton.classList.add("hidden");
    }
}

async function loadWorkDayStatus() {
    try {
        const res = await fetch("/MainPage?handler=WorkDayStatus", {
            method: "GET",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok || !data.status) {
            renderWorkDayStatusEmpty("Не удалось загрузить статус рабочего дня");
            return;
        }

        applyWorkDayStatus(data.status);
    } catch {
        renderWorkDayStatusEmpty("Ошибка загрузки статуса рабочего дня");
    }
}

function applyWorkDayStatus(status) {
    currentWorkDayStatus = status ? { ...status } : null;
    isWorkDayStarted = !!status.isWorking;

    idleTimeoutMinutes = Number(status.idleTimeoutMinutes || 3);
    updateIdleWatcherState();

    const startBtn = document.getElementById("startDayBtn");
    const stopBtn = document.getElementById("stopDayBtn");

    if (startBtn) {
        startBtn.classList.toggle("hidden", isWorkDayStarted);
    }

    if (stopBtn) {
        stopBtn.classList.toggle("hidden", !isWorkDayStarted);
    }

    renderWorkDayStatus(status);
}

function renderWorkDayStatusEmpty(text) {
    const box = document.getElementById("workDayStatusContent");
    if (!box) return;

    box.innerHTML = `<div style="color: var(--gray);">${text}</div>`;
}

function renderWorkDayStatus(status) {
    const box = document.getElementById("workDayStatusContent");
    if (!box || !status) return;

    const isFixed = (status.workMode || "fixed") === "fixed";
    const scheduleText = isFixed
        ? `${status.plannedStartTime || "--:--"} — ${status.plannedEndTime || "--:--"}`
        : "Гибкий график";

    const modeText = isFixed ? "Фиксированный" : "Гибкий";

    const lastMetricLabel = isFixed ? "До конца дня" : "Ещё по задачам";
    const lastMetricValue = isFixed
        ? Number(status.remainingToPlannedEndHours || 0).toFixed(1)
        : Number(status.remainingByTrackedHours || 0).toFixed(1);

    box.innerHTML = `
        <div class="workday-status-grid">
            <div class="workday-main-line">
                <div class="workday-schedule-block">
                    <div class="workday-label">Расписание</div>
                    <div class="workday-schedule-value">${scheduleText}</div>
                    <div class="workday-mode-note">${modeText}</div>
                </div>

                <div class="workday-state-block">
                    <div class="workday-label">Статус</div>
                    <div class="workday-state-value ${status.isWorking ? "is-working" : "is-stopped"}">
                        ${status.isWorking ? "Рабочий день начат" : "Рабочий день не начат"}
                    </div>
                </div>
            </div>

            <div class="workday-metrics-grid">
                <div class="workday-metric">
                    <div class="workday-label">Начало</div>
                    <div class="workday-metric-value">${status.startedAt || "--:--"}</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">Норма</div>
                    <div class="workday-metric-value">${Number(status.requiredDailyHours || 0).toFixed(1)} ч</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">Сейчас</div>
                    <div class="workday-metric-value">${Number(status.currentHours || 0).toFixed(1)} ч</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">По задачам</div>
                    <div class="workday-metric-value">${Number(status.trackedHours || 0).toFixed(1)} ч</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">Простой</div>
                    <div class="workday-metric-value">${Number(status.idleHours || 0).toFixed(1)} ч</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">До нормы</div>
                    <div class="workday-metric-value">${Number(status.remainingHours || 0).toFixed(1)} ч</div>
                </div>

                <div class="workday-metric">
                    <div class="workday-label">${lastMetricLabel}</div>
                    <div class="workday-metric-value">${lastMetricValue} ч</div>
                </div>
            </div>
        </div>
    `;
}

function renderWorkDayHistory() {
    const body = document.getElementById("workDayHistory");
    if (!body) return;

    const items = Array.isArray(workDays)
        ? workDays.map(normalizeWorkDayEntry)
        : [];

    if (!items.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--gray);">История рабочих сессий пока пуста</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = items.map(item => `
        <tr>
            <td>${item.date || "-"}</td>
            <td>${item.start || "-"}</td>
            <td>${item.end || "-"}</td>
            <td>${Number(item.hours || 0).toFixed(1)} ч</td>
        </tr>
    `).join("");
}

function initTrackerPage() {
    if (typeof fillTaskSelects === "function") {
        fillTaskSelects();
    }

    if (typeof syncTrackerTaskSelects === "function") {
        syncTrackerTaskSelects();
    }

    if (typeof loadCaptureSettings === "function") {
        loadCaptureSettings();
    }

    renderWorkDayHistory();
}

function bindIdleListeners() {
    if (idleListenersBound) return;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    events.forEach(eventName => {
        document.addEventListener(eventName, handleUserActivity, true);
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    idleListenersBound = true;
}

function handleUserActivity() {
    if (!isWorkDayStarted) return;
    resetIdleTimer();
}

function handleVisibilityChange() {
    if (!isWorkDayStarted) return;
    resetIdleTimer();
}

function clearIdleTimer() {
    if (idleTimerHandle) {
        clearTimeout(idleTimerHandle);
        idleTimerHandle = null;
    }
}

function resetIdleTimer() {
    clearIdleTimer();

    if (!isWorkDayStarted) return;

    const timeoutMs = Math.max(1, idleTimeoutMinutes) * 60 * 1000;

    idleTimerHandle = setTimeout(async () => {
        if (!isWorkDayStarted) return;
        if (!isTracking) return;
        if (idlePauseInProgress) return;

        idlePauseInProgress = true;

        try {
            await pauseTracking({ silent: true });
            await loadWorkDayStatus();
            showNotification("Таймер поставлен на паузу из-за бездействия");
        } finally {
            idlePauseInProgress = false;
        }
    }, timeoutMs);
}

function updateIdleWatcherState() {
    bindIdleListeners();

    if (!isWorkDayStarted) {
        clearIdleTimer();
        return;
    }

    resetIdleTimer();
}

function startWorkDayStatusPolling() {
    if (workDayStatusInterval) {
        clearInterval(workDayStatusInterval);
    }

    workDayStatusInterval = setInterval(() => {
        loadWorkDayStatus();
    }, 15000);
}

document.addEventListener("DOMContentLoaded", function () {
    updateTimerDisplay();
    updateBottomTrackerUI();

    if (document.getElementById("trackerPage")) {
        initTrackerPage();
    }

    bindIdleListeners();
    loadWorkDayStatus();
    startWorkDayStatusPolling();
});
