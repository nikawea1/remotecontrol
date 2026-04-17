// timer.js

let bottomTrackerExpanded = false;



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

    if (startBtn) {
        startBtn.disabled = isTracking;
    }

    if (pauseBtn) {
        pauseBtn.disabled = !isTracking;
    }

    if (stopBtn) {
        stopBtn.disabled = !isTracking && !isPaused;
    }
    const mainBtn = document.getElementById('bottomMainActionBtn');
    const mainIcon = document.getElementById('bottomMainActionIcon');

    if (mainBtn && mainIcon) {
        mainBtn.disabled = false;

        if (isTracking) {
            mainBtn.className = 'bottom-main-action';
            mainBtn.style.background = '#e53935';
            mainIcon.className = 'fas fa-stop';
        } else if (isPaused) {
            mainBtn.className = 'bottom-main-action';
            mainBtn.style.background = '#43a047';
            mainIcon.className = 'fas fa-play';
        } else {
            mainBtn.className = 'bottom-main-action';
            mainBtn.style.background = 'var(--primary)';
            mainIcon.className = 'fas fa-play';
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

function handleBottomMainAction() {
    if (isTracking) {
        stopTracking();
        return;
    }

    startTracking();
}

function updateTimer() {
    if (!isPaused && isTracking) {
        seconds++;
        updateTimerDisplay();
    }
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

    const task = getAvailableTimerTasks().find(t => Number(t.id) === Number(selectedTaskId));
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
        await startScreenshotCapture();
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function pauseTracking() {
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
            showNotification(data?.error || "Не удалось поставить таймер на паузу");
            return;
        }

        isPaused = true;
        isTracking = false;

        clearInterval(timerInterval);
        timerInterval = null;

        const task = getAvailableTimerTasks().find(t => Number(t.id) === Number(activeTaskId));
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
        stopScreenshotCapture();

        showNotification(`Таймер на паузе.\nУчтено: ${entry.hours} ч`);
    } catch {
        showNotification("Ошибка сети/сервера");
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

        stopScreenshotCapture();
        releaseScreenAccess();
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

        const task = getAvailableTimerTasks().find(t => Number(t.id) === Number(activeTaskId));
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

        stopScreenshotCapture();
        releaseScreenAccess();

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
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function stopTracker() {
    try {
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

        stopScreenshotCapture();
        releaseScreenAccess();

        showNotification(`Рабочий день завершен.\nОтработано: ${data.hours} ч`);
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function addTimeEntry() {
    const taskId = Number(document.getElementById("quickTask")?.value);
    const hoursRaw = document.getElementById("quickHours")?.value || "0";
    const hours = parseFloat(hoursRaw.replace(",", "."));
    const comment = document.getElementById("quickComment")?.value.trim() || "";
    const fileInput = document.getElementById("quickAttachment");
    const file = fileInput?.files?.[0] || null;

    if (!taskId || !hours || hours <= 0) {
        showNotification("Заполните задачу и часы");
        return;
    }

    try {
        const formData = new FormData();
        formData.append("taskId", String(taskId));
        formData.append("hours", String(hours));
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

        document.getElementById("quickHours").value = "1";
        document.getElementById("quickComment").value = "";

        if (fileInput) {
            fileInput.value = "";
        }

        showNotification("Заявка на ручное время отправлена");
    } catch {
        showNotification("Ошибка сети/сервера");
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

document.addEventListener("DOMContentLoaded", function () {
    updateTimerDisplay();
    updateBottomTrackerUI();
});


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