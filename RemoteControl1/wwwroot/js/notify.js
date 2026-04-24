// Файл: RemoteControl1/wwwroot/js/notify.js

function notifySuccess(message) {
    if (typeof showNotification === "function") {
        showNotification(message);
    }
}

function notifyError(message) {
    if (typeof showNotification === "function") {
        showNotification(message);
    }
}

function notifyInfo(message) {
    if (typeof showNotification === "function") {
        showNotification(message);
    }
}
