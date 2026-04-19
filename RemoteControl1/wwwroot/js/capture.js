//capture.js

let screenStream = null;
let screenshotVideo = null;
let screenScreenshotInterval = null;

let webcamStream = null;
let webcamVideo = null;
let webcamScreenshotInterval = null;

let screenIntervalMs = 10000;
let webcamIntervalMs = 10000;
let idleTimeoutMinutes = 3;

let enableScreenShots = true;
let enableWebcamShots = true;

function updateRangeValue(range, elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (elementId === "screenIntervalValue" || elementId === "webcamIntervalValue") {
        element.textContent = range.value + " сек";
        return;
    }

    if (elementId === "timeoutIntervalValue") {
        element.textContent = range.value + " мин";
        return;
    }

    element.textContent = range.value;
}

async function loadCaptureSettings() {
    try {
        const res = await fetch("/MainPage?handler=Profile");
        const data = await res.json();

        if (res.ok && data.ok && data.profile) {
            screenIntervalMs = Number(data.profile.screenIntervalSeconds || 10) * 1000;
            webcamIntervalMs = Number(data.profile.webcamIntervalSeconds || 10) * 1000;
            idleTimeoutMinutes = Number(data.profile.idleTimeoutMinutes || 3);

            enableScreenShots = !!data.profile.allowScreenShots;
            enableWebcamShots = !!data.profile.allowWebcamShots;
        }
    } catch {
        screenIntervalMs = 10000;
        webcamIntervalMs = 10000;
        idleTimeoutMinutes = 3;
        enableScreenShots = true;
        enableWebcamShots = true;
    }

    const screenInterval = document.getElementById("screenInterval");
    const webcamInterval = document.getElementById("webcamInterval");
    const idleTimeout = document.getElementById("idleTimeout");
    const enableScreen = document.getElementById("enableScreenShots");
    const enableWebcam = document.getElementById("enableWebcamShots");

    if (screenInterval) screenInterval.value = String(screenIntervalMs / 1000);
    if (webcamInterval) webcamInterval.value = String(webcamIntervalMs / 1000);
    if (idleTimeout) idleTimeout.value = String(idleTimeoutMinutes);

    if (enableScreen) enableScreen.checked = enableScreenShots;
    if (enableWebcam) enableWebcam.checked = enableWebcamShots;

    if (screenInterval) updateRangeValue(screenInterval, "screenIntervalValue");
    if (webcamInterval) updateRangeValue(webcamInterval, "webcamIntervalValue");
    if (idleTimeout) updateRangeValue(idleTimeout, "timeoutIntervalValue");
}

async function saveSettings() {
    const screenInterval = document.getElementById("screenInterval");
    const webcamInterval = document.getElementById("webcamInterval");
    const idleTimeout = document.getElementById("idleTimeout");

    const enableScreen = document.getElementById("enableScreenShots");
    const enableWebcam = document.getElementById("enableWebcamShots");

    const profileEmail =
        document.getElementById("profileEmail")?.value?.trim() ||
        document.getElementById("profileContactEmail")?.value?.trim() ||
        document.getElementById("dropdownEmail")?.textContent?.trim() ||
        "";

    const profilePhone =
        document.getElementById("profilePhone")?.value?.trim() ||
        document.getElementById("profileContactPhone")?.value?.trim() ||
        "";

    const profileContactNote = document.getElementById("profileContactNote")?.value || "";
    const profilePersonalNote = document.getElementById("profilePersonalNote")?.value || "";

    const profileNotifyUi = !!document.getElementById("profileNotifyUi")?.checked;
    const profileRememberTask = !!document.getElementById("profileRememberTask")?.checked;

    const allowScreenShots = !!enableScreen?.checked;
    const allowWebcamShots = !!enableWebcam?.checked;

    const screenIntervalSeconds = Number(screenInterval?.value || 10);
    const webcamIntervalSeconds = Number(webcamInterval?.value || 10);
    const idleTimeoutValue = Number(idleTimeout?.value || 3);

    try {
        const res = await fetch("/MainPage?handler=SaveProfile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                email: profileEmail,
                phone: profilePhone,
                contactNote: profileContactNote,
                notifyInUi: profileNotifyUi,
                rememberLastTask: profileRememberTask,
                allowScreenShots: allowScreenShots,
                allowWebcamShots: allowWebcamShots,
                screenIntervalSeconds: screenIntervalSeconds,
                webcamIntervalSeconds: webcamIntervalSeconds,
                idleTimeoutMinutes: idleTimeoutValue,
                personalNote: profilePersonalNote
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось сохранить настройки");
            return;
        }

        screenIntervalMs = Number(data.screenIntervalSeconds || 10) * 1000;
        webcamIntervalMs = Number(data.webcamIntervalSeconds || 10) * 1000;
        idleTimeoutMinutes = Number(data.idleTimeoutMinutes || 3);

        enableScreenShots = !!data.allowScreenShots;
        enableWebcamShots = !!data.allowWebcamShots;

        if (isTracking && !isPaused) {
            startScreenshotCapture();
        }

        showNotification("Настройки сохранены");
    } catch {
        showNotification("Ошибка сети");
    }
}

function resetSettings() {
    const screenInterval = document.getElementById("screenInterval");
    const webcamInterval = document.getElementById("webcamInterval");
    const idleTimeout = document.getElementById("idleTimeout");

    const enableScreen = document.getElementById("enableScreenShots");
    const enableWebcam = document.getElementById("enableWebcamShots");

    if (screenInterval) screenInterval.value = "10";
    if (webcamInterval) webcamInterval.value = "10";
    if (idleTimeout) idleTimeout.value = "3";

    if (enableScreen) enableScreen.checked = true;
    if (enableWebcam) enableWebcam.checked = true;

    if (screenInterval) updateRangeValue(screenInterval, "screenIntervalValue");
    if (webcamInterval) updateRangeValue(webcamInterval, "webcamIntervalValue");
    if (idleTimeout) updateRangeValue(idleTimeout, "timeoutIntervalValue");

    screenIntervalMs = 10000;
    webcamIntervalMs = 10000;
    idleTimeoutMinutes = 3;
    enableScreenShots = true;
    enableWebcamShots = true;

    showNotification("Значения сброшены. Не забудьте сохранить");
}

async function ensureWebcamAccess() {
    if (webcamStream) {
        return true;
    }

    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        webcamVideo = document.createElement("video");
        webcamVideo.style.display = "none";
        webcamVideo.srcObject = webcamStream;
        webcamVideo.muted = true;
        webcamVideo.playsInline = true;

        document.body.appendChild(webcamVideo);
        await webcamVideo.play();

        webcamStream.getVideoTracks()[0].addEventListener("ended", function () {
            releaseWebcamAccess();
            showNotification("Доступ к веб-камере прекращен");
        });

        return true;
    } catch {
        showNotification("Пользователь не разрешил доступ к веб-камере");
        return false;
    }
}

async function captureWebcamScreenshot() {
    if (!webcamVideo || !webcamStream || !isTracking || isPaused) {
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const formData = new FormData();
    formData.append("file", blob, "webcam.png");
    formData.append("taskId", String(activeTaskId || 0));

    try {
        const res = await fetch("/MainPage?handler=UploadWebcamScreenshot", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            console.log("Ошибка сохранения снимка веб-камеры");
        }
    } catch {
        console.log("Ошибка отправки снимка веб-камеры");
    }
}

function releaseWebcamAccess() {
    if (webcamScreenshotInterval) {
        clearInterval(webcamScreenshotInterval);
        webcamScreenshotInterval = null;
    }

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }

    if (webcamVideo) {
        webcamVideo.remove();
        webcamVideo = null;
    }
}

async function ensureScreenAccess() {
    if (screenStream) {
        return true;
    }

    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });

        screenshotVideo = document.createElement("video");
        screenshotVideo.style.display = "none";
        screenshotVideo.srcObject = screenStream;
        screenshotVideo.muted = true;
        screenshotVideo.playsInline = true;

        document.body.appendChild(screenshotVideo);
        await screenshotVideo.play();

        screenStream.getVideoTracks()[0].addEventListener("ended", function () {
            releaseScreenAccess();
            showNotification("Доступ к экрану прекращен");
        });

        return true;
    } catch {
        showNotification("Пользователь не разрешил доступ к экрану");
        return false;
    }
}

async function captureScreenshot() {
    if (!screenshotVideo || !screenStream || !isTracking || isPaused) {
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = screenshotVideo.videoWidth;
    canvas.height = screenshotVideo.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(screenshotVideo, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const formData = new FormData();
    formData.append("file", blob, "screen.png");
    formData.append("taskId", String(activeTaskId || 0));

    try {
        const res = await fetch("/MainPage?handler=UploadScreenshot", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            console.log("Ошибка сохранения скриншота");
        }
    } catch {
        console.log("Ошибка отправки скриншота");
    }
}

async function startScreenshotCapture() {
    stopScreenshotCapture();

    let startedAnything = false;

    if (enableScreenShots) {
        const screenOk = await ensureScreenAccess();
        if (screenOk) {
            screenScreenshotInterval = setInterval(async () => {
                if (!isTracking || isPaused) return;
                await captureScreenshot();
            }, screenIntervalMs);

            startedAnything = true;
        }
    }

    if (enableWebcamShots) {
        const webcamOk = await ensureWebcamAccess();
        if (webcamOk) {
            webcamScreenshotInterval = setInterval(async () => {
                if (!isTracking || isPaused) return;
                await captureWebcamScreenshot();
            }, webcamIntervalMs);

            startedAnything = true;
        }
    }

    return startedAnything;
}

function stopScreenshotCapture() {
    if (screenScreenshotInterval) {
        clearInterval(screenScreenshotInterval);
        screenScreenshotInterval = null;
    }

    if (webcamScreenshotInterval) {
        clearInterval(webcamScreenshotInterval);
        webcamScreenshotInterval = null;
    }
}

function releaseScreenAccess() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    if (screenshotVideo) {
        screenshotVideo.remove();
        screenshotVideo = null;
    }

    releaseWebcamAccess();
}