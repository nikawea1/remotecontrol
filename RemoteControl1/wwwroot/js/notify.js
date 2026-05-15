// Файл: RemoteControl1/wwwroot/js/notify.js

function notifySuccess(message) {
    if (typeof showNotification === "function") showNotification(message, "success");
}

function notifyError(message) {
    if (typeof showNotification === "function") showNotification(message, "error");
}

function notifyInfo(message) {
    if (typeof showNotification === "function") showNotification(message, "info");
}
