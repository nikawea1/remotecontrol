// Файл: RemoteControl1/wwwroot/js/dashboard.js

function initDashboardPage() {
    if (typeof fillTaskSelects === "function") fillTaskSelects();
    if (typeof syncTrackerTaskSelects === "function") syncTrackerTaskSelects();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof renderDashboardTasks === "function") renderDashboardTasks();
    if (typeof renderActivityLog === "function") renderActivityLog();
    if (typeof loadWorkDayStatus === "function") loadWorkDayStatus();
}
