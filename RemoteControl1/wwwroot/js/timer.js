
//timer.js
function updateTimer() {
    if (!isPaused && isTracking) {
        seconds++;

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const timeString =
            `${hours.toString().padStart(2, "0")}:` +
            `${minutes.toString().padStart(2, "0")}:` +
            `${secs.toString().padStart(2, "0")}`;

        document.querySelectorAll(".timer, #bottomTimer").forEach(timer => {
            timer.textContent = timeString;
        });
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
            body: JSON.stringify({
                taskId: task.id,
                comment: ""
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось запустить таймер");
            return;
        }

        setActiveTask(task);

        if (!isTracking) {
            isTracking = true;
            isPaused = false;

            if (!timerInterval) {
                timerInterval = setInterval(updateTimer, 1000);
            }

            const statusText = document.getElementById("statusText");
            const statusDot = document.getElementById("statusDot");

            if (statusText) statusText.textContent = "Активен";
            if (statusDot) statusDot.className = "status-dot active";

            highlightBottomTracker();
            showNotification(`Трекер запущен: ${task.name}`);
            await startScreenshotCapture();
        }
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

        const statusText = document.getElementById("statusText");
        const statusDot = document.getElementById("statusDot");

        if (statusText) statusText.textContent = "На паузе";
        if (statusDot) statusDot.className = "status-dot paused";

        showNotification(`Таймер на паузе. Учтено: ${entry.hours} ч`);
        stopScreenshotCapture();
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

        document.querySelectorAll(".timer, #bottomTimer").forEach(timer => {
            timer.textContent = "00:00:00";
        });

        const statusText = document.getElementById("statusText");
        const statusDot = document.getElementById("statusDot");

        if (statusText) statusText.textContent = "Остановлен";
        if (statusDot) statusDot.className = "status-dot stopped";

        renderActivityLog();
        renderDashboard();

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

        clearInterval(timerInterval);
        timerInterval = null;

        seconds = 0;

        document.querySelectorAll(".timer, #bottomTimer").forEach(timer => {
            timer.textContent = "00:00:00";
        });

        const statusText = document.getElementById("statusText");
        const statusDot = document.getElementById("statusDot");

        if (statusText) statusText.textContent = "Остановлен";
        if (statusDot) statusDot.className = "status-dot stopped";

        renderActivityLog();
        renderDashboard();

        stopScreenshotCapture();
        releaseScreenAccess();

        showNotification(`Сессия завершена. Отработано: ${entry.hours} ч`);
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
        if (isTracking) {
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

        document.querySelectorAll(".timer, #bottomTimer").forEach(timer => {
            timer.textContent = "00:00:00";
        });

        const startBtn = document.getElementById("startDayBtn");
        const stopBtn = document.getElementById("stopDayBtn");
        const statusText = document.getElementById("statusText");
        const statusDot = document.getElementById("statusDot");

        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");
        if (statusText) statusText.textContent = "Остановлен";
        if (statusDot) statusDot.className = "status-dot stopped";

        stopScreenshotCapture();
        releaseScreenAccess();

        showNotification(`Рабочий день завершен. Отработано: ${data.hours} ч`);
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
        if (fileInput) fileInput.value = "";

        showNotification("Заявка на ручное время отправлена");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function highlightBottomTracker() {
    const tracker = document.getElementById("bottomTracker");
    if (!tracker) {
        return;
    }

    tracker.classList.remove("attention");
    void tracker.offsetWidth;
    tracker.classList.add("attention");

    setTimeout(() => {
        tracker.classList.remove("attention");
    }, 1600);
}