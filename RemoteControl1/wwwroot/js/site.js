window.remoteControlData = window.remoteControlData || {};

window.currentUserId = window.remoteControlData.currentUserId ?? 0;
window.currentUserRole = window.remoteControlData.currentUserRole ?? "employee";
window.isAdmin = String(window.remoteControlData.isAdmin) === "true";
window.isManager = String(window.remoteControlData.isManager) === "true";
window.isEmployee = String(window.remoteControlData.isEmployee) === "true";

window.tasks = Array.isArray(window.remoteControlData.tasks) ? window.remoteControlData.tasks : [];
window.projects = Array.isArray(window.remoteControlData.projects) ? window.remoteControlData.projects : [];
window.users = Array.isArray(window.remoteControlData.users) ? window.remoteControlData.users : [];
window.activity = Array.isArray(window.remoteControlData.activity) ? window.remoteControlData.activity : [];
window.workDays = Array.isArray(window.remoteControlData.workDays) ? window.remoteControlData.workDays : [];
window.calendarEvents = Array.isArray(window.remoteControlData.calendarEvents) ? window.remoteControlData.calendarEvents : [];
window.timeEntries = Array.isArray(window.remoteControlData.timeEntries) ? window.remoteControlData.timeEntries : [];

function getRequestVerificationToken() {
    const input = document.querySelector('input[name="__RequestVerificationToken"]');
    return input ? input.value : "";
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (!dropdown) return;
    dropdown.classList.toggle("show");
}

document.addEventListener("click", function (e) {
    const block = document.getElementById("headerUserBlock");
    const dropdown = document.getElementById("profileDropdown");

    if (!block || !dropdown) return;

    if (!block.contains(e.target)) {
        dropdown.classList.remove("show");
    }
});

async function logout() {
    try {
        const token = getRequestVerificationToken();

        const res = await fetch("/Auth?handler=Logout", {
            method: "POST",
            headers: {
                "RequestVerificationToken": token
            }
        });

        if (res.ok) {
            window.location.href = "/Auth";
            return;
        }
    } catch (e) {
        console.error(e);
    }

    window.location.href = "/Auth";
}

function normalizeProject(project) {
    if (!project) return project;

    return {
        ...project,
        id: Number(project.id || 0),
        managerId: project.managerId != null ? Number(project.managerId) : null,
        memberIds: Array.isArray(project.memberIds) ? project.memberIds.map(x => Number(x)) : [],
        stageNames: Array.isArray(project.stageNames) ? project.stageNames : [],
        projectTypeName: project.projectTypeName || project.projectType || "functional",
        progress: Number(project.progress || 0),
        tasksCount: Number(project.tasksCount || 0),
        membersCount: Number(project.membersCount || 0)
    };
}

function normalizeTask(task) {
    if (!task) return task;

    return {
        ...task,
        id: Number(task.id || 0),
        projectId: task.projectId != null ? Number(task.projectId) : null,
        userId: task.userId != null ? Number(task.userId) : null,
        plannedTime: Number(task.plannedTime || 0)
    };
}

function normalizeUser(user) {
    if (!user) return user;

    return {
        ...user,
        id: Number(user.id || 0),
        rate: Number(user.rate || 0)
    };
}

window.projects = window.projects.map(normalizeProject);
window.tasks = window.tasks.map(normalizeTask);
window.users = window.users.map(normalizeUser);

function getStatusText(status) {
    const value = String(status || "").toLowerCase();

    if (value === "new") return "Новая";
    if (value === "progress") return "В работе";
    if (value === "review") return "На проверке";
    if (value === "done") return "Завершена";

    return "—";
}

function getPriorityText(priority) {
    const value = String(priority || "").toLowerCase();

    if (value === "high") return "Высокий";
    if (value === "medium") return "Средний";
    if (value === "low") return "Низкий";

    return "—";
}

function safeCall(fnName) {
    const fn = window[fnName];
    if (typeof fn === "function") {
        try {
            fn();
        } catch (e) {
            console.error(`Ошибка в ${fnName}:`, e);
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("projectsPage")) {
        safeCall("filterProjects");
    }

    if (document.getElementById("reportsPage")) {
        safeCall("initReportsPage");
    }

    if (document.getElementById("calendarPage")) {
        safeCall("initCalendarPage");
    }

    if (document.getElementById("profilePage")) {
        safeCall("initProfilePage");
    }

    if (document.getElementById("usersPage")) {
        safeCall("initUsersPage");
    }

    if (document.getElementById("trackerPage")) {
        safeCall("initTrackerPage");
    }

    if (document.getElementById("dashboardPage")) {
        safeCall("initDashboardPage");
    }
});