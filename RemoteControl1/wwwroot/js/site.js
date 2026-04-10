//site.js


const remoteControlData = window.remoteControlData || {};

function normalizeTask(task) {
    return {
        id: Number(task.id ?? task.Id ?? 0),
        name: task.name ?? task.Name ?? "",
        project: task.project ?? task.Project ?? "",
        projectId: Number(task.projectId ?? task.ProjectId ?? 0),
        userId: Number(task.userId ?? task.UserId ?? 0),
        stageName: task.stageName ?? task.StageName ?? "",
        status: task.status ?? task.Status ?? "new",
        priority: task.priority ?? task.Priority ?? "medium",
        deadline: task.deadline ?? task.Deadline ?? "",
        deadlineRaw: task.deadlineRaw ?? task.DeadlineRaw ?? "",
        description: task.description ?? task.Description ?? "",
        assignee: task.assignee ?? task.Assignee ?? "",
        plannedTime: Number(task.plannedTime ?? task.PlannedTime ?? 0)
    };
}

function normalizeProject(project) {
    return {
        id: Number(project.id ?? project.Id ?? 0),
        name: project.name ?? project.Name ?? "",
        description: project.description ?? project.Description ?? "",
        tasksCount: Number(project.tasksCount ?? project.TasksCount ?? 0),
        progress: Number(project.progress ?? project.Progress ?? 0),
        managerId: Number(project.managerId ?? project.ManagerId ?? 0),
        managerName: project.managerName ?? project.ManagerName ?? "",
        memberIds: Array.isArray(project.memberIds ?? project.MemberIds)
            ? (project.memberIds ?? project.MemberIds).map(Number)
            : [],
        membersCount: Number(project.membersCount ?? project.MembersCount ?? 0),
        projectTypeName: project.projectTypeName ?? project.ProjectTypeName ?? "Проект",
        stageNames: Array.isArray(project.stageNames ?? project.StageNames)
            ? (project.stageNames ?? project.StageNames)
            : []
    };
}

function normalizeUser(user) {
    return {
        id: Number(user.id ?? user.Id ?? 0),
        fullName: user.fullName ?? user.FullName ?? "",
        login: user.login ?? user.Login ?? "",
        email: user.email ?? user.Email ?? "",
        phone: user.phone ?? user.Phone ?? "",
        position: user.position ?? user.Position ?? "",
        role: user.role ?? user.Role ?? "employee",
        hourlyRate: Number(user.hourlyRate ?? user.HourlyRate ?? 0),
        status: user.status ?? user.Status ?? "active",
        tasksInProgress: Number(user.tasksInProgress ?? user.TasksInProgress ?? 0),
        completedTasks: Number(user.completedTasks ?? user.CompletedTasks ?? 0),
        overdueTasks: Number(user.overdueTasks ?? user.OverdueTasks ?? 0),
        totalHours: Number(user.totalHours ?? user.TotalHours ?? 0),
        plannedHours: Number(user.plannedHours ?? user.PlannedHours ?? 0)
    };
}

function normalizeActivity(item) {
    return {
        date: item.date ?? item.Date ?? "",
        task: item.task ?? item.Task ?? "",
        hours: Number(item.hours ?? item.Hours ?? 0),
        comment: item.comment ?? item.Comment ?? ""
    };
}

let tasks = Array.isArray(remoteControlData.tasks)
    ? remoteControlData.tasks.map(normalizeTask)
    : [];

let projects = Array.isArray(remoteControlData.projects)
    ? remoteControlData.projects.map(normalizeProject)
    : [];

let users = Array.isArray(remoteControlData.users)
    ? remoteControlData.users.map(normalizeUser)
    : [];

let filteredProjects = [...projects];

let timeEntries = Array.isArray(remoteControlData.activity)
    ? remoteControlData.activity.map(normalizeActivity)
    : [];


let manualTimeRequests = [];


const currentUserId = Number(remoteControlData.currentUserId || 0);
const currentUserName = remoteControlData.currentUserName || "";
const currentUserEmail = remoteControlData.currentUserEmail || "";
const currentUserRole = (remoteControlData.currentUserRole || "").toLowerCase();
const isAdmin = !!remoteControlData.isAdmin;
const isManager = !!remoteControlData.isManager;
const isEmployee = !!remoteControlData.isEmployee;

const currentUserLogin = remoteControlData.currentUserLogin || "";
const currentUserPhone = remoteControlData.currentUserPhone || "";
const currentUserPosition = remoteControlData.currentUserPosition || "";
const currentUserRate = Number(remoteControlData.currentUserRate || 0);
const currentUserIsActive = !!remoteControlData.currentUserIsActive;

let seconds = 0;
let timerInterval = null;
let isTracking = false;
let isPaused = false;
let isWorkDayStarted = false;
let activeTaskId = null;
let activeTaskName = "";

function getRequestVerificationToken() {
    const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
    return tokenInput ? tokenInput.value : "";
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;

    el.classList.remove("show");
    el.style.display = "none";
}

function showNotification(message) {
    const notification = document.getElementById("notification");
    const messageEl = document.getElementById("notificationMessage");

    if (messageEl) {
        messageEl.textContent = message;
    }

    if (notification) {
        notification.classList.remove("hidden");
        setTimeout(() => {
            notification.classList.add("hidden");
        }, 2000);
    }
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) {
        dropdown.classList.toggle("show");
    }
}

async function logout() {
    if (!confirm("Вы уверены, что хотите выйти?")) {
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=Logout", {
            method: "POST",
            headers: {
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (data.ok) {
            window.location.href = data.redirect || "/Auth";
            return;
        }

        showNotification("Не удалось выйти из аккаунта");
    } catch {
        showNotification("Ошибка выхода");
    }
}

function getRoleBadge(role) {
    if (role === "admin") {
        return '<span class="task-status status-done">Администратор</span>';
    }

    if (role === "manager") {
        return '<span class="task-status status-review">Руководитель</span>';
    }

    return '<span class="task-status status-inprogress">Сотрудник</span>';
}

function getUserStatusBadge(status) {
    return status === "blocked"
        ? '<span class="task-status status-new">Заблокирован</span>'
        : '<span class="task-status status-done">Активен</span>';
}

function getPriorityClass(priority) {
    return ({
        high: "badge-danger",
        medium: "badge-warning",
        low: "badge-success"
    }[priority]) || "badge-warning";
}

function getStatusClass(status) {
    return ({
        new: "badge-info",
        progress: "badge-warning",
        review: "badge-warning",
        done: "badge-success"
    }[status]) || "badge-warning";
}

function getPriorityText(priority) {
    return ({
        high: "Высокий",
        medium: "Средний",
        low: "Низкий"
    }[priority]) || priority;
}

function getStatusText(status) {
    return ({
        new: "Новая",
        progress: "В работе",
        review: "На проверке",
        done: "Завершена"
    }[status]) || status;
}

function getStatusBadgeClass(status) {
    return ({
        new: "status-new",
        progress: "status-progress",
        review: "status-review",
        done: "status-done"
    }[status]) || "status-new";
}

function extractLastName(fullName) {
    return (fullName || "").split(" ")[0] || "";
}

function extractFirstName(fullName) {
    return (fullName || "").split(" ")[1] || "";
}

function extractMiddleName(fullName) {
    return (fullName || "").split(" ").slice(2).join(" ");
}

function showPage(pageId) {
    document.querySelectorAll(".page-content").forEach(page => page.classList.add("hidden"));

    const pageEl = document.getElementById(pageId + "Page");
    if (pageEl) {
        pageEl.classList.remove("hidden");
    }

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
        const clickAttr = link.getAttribute("onclick");
        if (clickAttr && clickAttr.includes(pageId)) {
            link.classList.add("active");
        }
    });

    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) {
        dropdown.classList.remove("show");
    }

    if (pageId === "dashboard") {
        renderDashboard();
        renderDashboardTasks();
    }

    if (pageId === "tasks") {
        renderTasksTable();
    }

    if (pageId === "projects") {
        renderProjects();
    }

    if (pageId === "users") {
        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        loadManualTimeRequests();
    }

    if (pageId === "reports") {
        initReportsPage();
        showReport("daily");
    }

    if (pageId === "profile") {
        document.getElementById("profileInfo")?.classList.remove("hidden");
    }

    if (pageId === "calendar") {
        initCalendarPage();
    }

}

document.addEventListener("DOMContentLoaded", function () {
    loadCaptureSettings();

    refreshProjectsStats();
    fillProjectFilter();
    fillProjectSelect("taskProjectSelect");
    fillProjectSelect("editTaskProject");

    fillTaskStageSelect(0, "taskStageSelect", "");
    fillTaskStageSelect(0, "editTaskStageSelect", "");

    fillTaskSelects();
    syncTrackerTaskSelects();

    renderDashboard();
    renderDashboardTasks();
    renderProjects();
    renderTasksTable();
    renderActivityLog();

    renderAdminStats();
    renderUsersTable();
    renderWorkloadTable();
    renderProductivityTable();
    renderSalaryTable();
    renderBonusesTable();
    renderControlTab();
   

    renderWorkDayHistory();
    initProfilePage();

    loadWorkStatus();


    document.addEventListener("click", function (event) {
        const dropdown = document.getElementById("profileDropdown");
        const avatar = document.getElementById("userAvatar");

        if (avatar && dropdown && !avatar.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove("show");
        }

        if (!event.target.closest(".status-dropdown")) {
            document.querySelectorAll(".status-menu").forEach(menu => {
                menu.classList.add("hidden");
            });
        }
    });

    document.addEventListener("click", function (event) {
        const modal = event.target.closest(".modal");

        if (!modal) return;

        if (event.target !== modal) return;

        event.stopPropagation();
        closeModal(modal.id);
    });




});



function showProfileTab(tabId, btn) {
    ["profileInfo", "profileContacts", "profileWork", "profileSecurity", "profilePrefs"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    document.querySelectorAll("#profilePage .admin-tab-btn").forEach(x => x.classList.remove("active"));

    document.getElementById(tabId)?.classList.remove("hidden");
    btn?.classList.add("active");

    if (tabId === "profileWork") {
        renderProfileWorkTab();
    }
}

function getRoleText(role) {
    if (role === "admin") return "Администратор";
    if (role === "manager") return "Руководитель";
    return "Сотрудник";
}

function getStatusTextFull(isActive) {
    return isActive ? "Активен" : "Заблокирован";
}

async function initProfilePage() {
    const roleText = getRoleText(currentUserRole);
    const statusText = getStatusTextFull(currentUserIsActive);
    const rateText = currentUserRate > 0 ? `${currentUserRate.toLocaleString("ru-RU")} руб.` : "—";

    const profileRole = document.getElementById("profileRole");
    const profileStatus = document.getElementById("profileStatus");
    const profileRate = document.getElementById("profileRate");

    const profileRoleText = document.getElementById("profileRoleText");
    const profileStatusText = document.getElementById("profileStatusText");
    const profileRateText = document.getElementById("profileRateText");

    if (profileRole) profileRole.value = roleText;
    if (profileStatus) profileStatus.value = statusText;
    if (profileRate) profileRate.value = rateText;

    if (profileRoleText) profileRoleText.textContent = roleText;
    if (profileStatusText) profileStatusText.textContent = statusText;
    if (profileRateText) profileRateText.textContent = rateText;

    try {
        const res = await fetch("/MainPage?handler=Profile");
        const data = await res.json();

        if (res.ok && data.ok && data.profile) {
            const profileContactNote = document.getElementById("profileContactNote");
            const profilePersonalNote = document.getElementById("profilePersonalNote");
            const profileNotifyUi = document.getElementById("profileNotifyUi");
            const profileRememberTask = document.getElementById("profileRememberTask");
            const profileUseScreens = document.getElementById("profileUseScreens");
            const profileUseWebcam = document.getElementById("profileUseWebcam");

            if (profileContactNote) profileContactNote.value = data.profile.contactNote || "";
            if (profilePersonalNote) profilePersonalNote.value = data.profile.personalNote || "";
            if (profileNotifyUi) profileNotifyUi.checked = !!data.profile.notifyInUi;
            if (profileRememberTask) profileRememberTask.checked = !!data.profile.rememberLastTask;
            if (profileUseScreens) profileUseScreens.checked = !!data.profile.allowScreenShots;
            if (profileUseWebcam) profileUseWebcam.checked = !!data.profile.allowWebcamShots;

            enableScreenShots = !!data.profile.allowScreenShots;
            enableWebcamShots = !!data.profile.allowWebcamShots;

            const screenCheckbox = document.getElementById("enableScreenShots");
            const webcamCheckbox = document.getElementById("enableWebcamShots");

            if (screenCheckbox) screenCheckbox.checked = enableScreenShots;
            if (webcamCheckbox) webcamCheckbox.checked = enableWebcamShots;
        }
    } catch {
        console.log("Не удалось загрузить профиль");
    }

    renderProfileWorkTab();
}

function renderProfileWorkTab() {
    const activeTasks = tasks.filter(t => t.status?.toLowerCase() !== "done").length;
    const doneTasks = tasks.filter(t => t.status?.toLowerCase() === "done").length;
    const hours = timeEntries.reduce((sum, x) => sum + Number(x.hours || 0), 0);
    const projectsCount = projects.length;

    const profileActiveTasks = document.getElementById("profileActiveTasks");
    const profileDoneTasks = document.getElementById("profileDoneTasks");
    const profileHours = document.getElementById("profileHours");
    const profileProjectsCount = document.getElementById("profileProjectsCount");

    if (profileActiveTasks) profileActiveTasks.textContent = activeTasks;
    if (profileDoneTasks) profileDoneTasks.textContent = doneTasks;
    if (profileHours) profileHours.textContent = hours.toFixed(1).replace(".0", "");
    if (profileProjectsCount) profileProjectsCount.textContent = projectsCount;

    const body = document.getElementById("profileActivityBody");
    if (!body) return;

    if (!timeEntries.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--gray);">Активности пока нет</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = timeEntries.slice(0, 5).map(entry => `
        <tr>
            <td>${entry.date || "-"}</td>
            <td>${entry.task || "-"}</td>
            <td>${Number(entry.hours || 0).toFixed(1)} ч</td>
            <td>${entry.comment || "-"}</td>
        </tr>
    `).join("");
}



function resetProfilePreferences() {
    const profileNotifyUi = document.getElementById("profileNotifyUi");
    const profileRememberTask = document.getElementById("profileRememberTask");
    const profileUseScreens = document.getElementById("profileUseScreens");
    const profileUseWebcam = document.getElementById("profileUseWebcam");
    const profilePersonalNote = document.getElementById("profilePersonalNote");

    if (profileNotifyUi) profileNotifyUi.checked = true;
    if (profileRememberTask) profileRememberTask.checked = false;
    if (profileUseScreens) profileUseScreens.checked = true;
    if (profileUseWebcam) profileUseWebcam.checked = true;
    if (profilePersonalNote) profilePersonalNote.value = "";

    showNotification("Настройки сброшены. Не забудьте сохранить");
}



let workDays = Array.isArray(remoteControlData.workDays) ? remoteControlData.workDays : [];

function renderWorkDayHistory() {
    const body = document.getElementById("workDayHistory");
    if (!body) return;

    if (!workDays.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--gray);">История пока пуста</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = workDays.map(x => `
        <tr>
            <td>${x.date}</td>
            <td>${x.start}</td>
            <td>${x.end}</td>
            <td>${x.hours} ч</td>
        </tr>
    `).join("");
}

async function loadManualTimeRequests() {
    try {
        const res = await fetch("/MainPage?handler=ManualTimeRequests");
        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось загрузить заявки");
            return;
        }

        manualTimeRequests = Array.isArray(data.items) ? data.items : [];
        renderManualTimeRequests();
    } catch {
        showNotification("Ошибка загрузки заявок");
    }
}

function renderManualTimeRequests() {
    const body = document.getElementById("manualTimeRequestsBody");
    if (!body) return;

    if (!manualTimeRequests.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Заявок пока нет</td>
            </tr>
        `;
        return;
    }

    const canReview = isAdmin || isManager;

    body.innerHTML = manualTimeRequests.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canShowActions = canReview && status !== "approved" && status !== "rejected";

        return `
            <tr>
                <td>${x.id}</td>
                <td>${x.employee || "-"}</td>
                <td>${x.taskName || "-"}</td>
                <td>${x.projectName || "-"}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${x.comment || "-"}</td>
               <td>
    ${x.attachmentPath
                ? `<a href="${x.attachmentPath}"
              target="_blank"
              class="btn btn-sm btn-outline manual-file-btn"
              title="${x.attachmentName || "Файл"}">
                <i class="fas fa-paperclip"></i>
           </a>`
                : `<span style="display:inline-block; width:100%; text-align:center;">-</span>`}
</td>
                <td>${renderManualTimeStatus(status)}</td>
               <td title="${x.createdAt || "-"}">
    ${formatManualRequestDate(x.createdAt)}
</td>
             <td>
    ${canShowActions ? `
        <div class="table-actions">
            <button class="btn btn-sm btn-success" type="button" onclick="approveManualTimeRequest(${x.id})" title="Одобрить">
                <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-sm btn-danger" type="button" onclick="rejectManualTimeRequest(${x.id})" title="Отклонить">
                <i class="fas fa-times"></i>
            </button>
        </div>
    ` : `<span>-</span>`}
</td>
            </tr>
        `;
    }).join("");
}



function renderManualTimeStatus(status) {
    if (status === "approved") {
        return `<span class="task-status status-done">Одобрено</span>`;
    }

    if (status === "rejected") {
        return `<span class="task-status status-new">Отклонено</span>`;
    }

    return `<span class="task-status status-review">Ожидание</span>`;
}

async function approveManualTimeRequest(id) {
    try {
        const res = await fetch("/MainPage?handler=ApproveManualTimeRequest", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                id: id,
                managerComment: ""
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось одобрить заявку");
            return;
        }

        showNotification("Заявка одобрена");
        loadManualTimeRequests();
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function rejectManualTimeRequest(id) {
    try {
        const res = await fetch("/MainPage?handler=RejectManualTimeRequest", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                id: id,
                managerComment: ""
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось отклонить заявку");
            return;
        }

        showNotification("Заявка отклонена");
        loadManualTimeRequests();
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function changePassword() {
    const oldPassword = document.getElementById("profileCurrentPassword")?.value || "";
    const newPassword = document.getElementById("profileNewPassword")?.value || "";
    const confirmPassword = document.getElementById("profileConfirmPassword")?.value || "";

    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification("Заполните все поля");
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification("Новый пароль и подтверждение не совпадают");
        return;
    }

    if (newPassword.length < 4) {
        showNotification("Пароль слишком короткий");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=ChangePassword", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                oldPassword: oldPassword,
                newPassword: newPassword
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка смены пароля");
            return;
        }

        document.getElementById("profileCurrentPassword").value = "";
        document.getElementById("profileNewPassword").value = "";
        document.getElementById("profileConfirmPassword").value = "";

        showNotification("Пароль успешно изменён");
    } catch {
        showNotification("Ошибка сети");
    }
}

async function loadWorkStatus() {
    try {
        const res = await fetch("/MainPage?handler=WorkStatus");
        const data = await res.json();

        if (!res.ok || !data.ok) {
            return;
        }

        isWorkDayStarted = !!data.isWorking;

        const startBtn = document.getElementById("startDayBtn");
        const stopBtn = document.getElementById("stopDayBtn");

        if (isWorkDayStarted) {
            if (startBtn) startBtn.classList.add("hidden");
            if (stopBtn) stopBtn.classList.remove("hidden");
        } else {
            if (startBtn) startBtn.classList.remove("hidden");
            if (stopBtn) stopBtn.classList.add("hidden");
        }
    } catch {
        console.log("Не удалось загрузить статус рабочего дня");
    }
}


async function saveProfile() {
    const email =
        document.getElementById("profileEmail")?.value?.trim() ||
        document.getElementById("profileContactEmail")?.value?.trim() ||
        "";

    const phone =
        document.getElementById("profilePhone")?.value?.trim() ||
        document.getElementById("profileContactPhone")?.value?.trim() ||
        "";

    const contactNote = document.getElementById("profileContactNote")?.value || "";
    const personalNote = document.getElementById("profilePersonalNote")?.value || "";

    const notifyInUi = !!document.getElementById("profileNotifyUi")?.checked;
    const rememberLastTask = !!document.getElementById("profileRememberTask")?.checked;
    const allowScreenShots = !!document.getElementById("profileUseScreens")?.checked;
    const allowWebcamShots = !!document.getElementById("profileUseWebcam")?.checked;

    if (!email) {
        showNotification("Введите email");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=SaveProfile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                email,
                phone,
                contactNote,
                notifyInUi,
                rememberLastTask,
                allowScreenShots,
                allowWebcamShots,
                personalNote
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось сохранить профиль");
            return;
        }

        const profileEmail = document.getElementById("profileEmail");
        const profilePhone = document.getElementById("profilePhone");
        const profileContactEmail = document.getElementById("profileContactEmail");
        const profileContactPhone = document.getElementById("profileContactPhone");
        const profileContactNote = document.getElementById("profileContactNote");
        const profilePersonalNote = document.getElementById("profilePersonalNote");
        const profileNotifyUi = document.getElementById("profileNotifyUi");
        const profileRememberTask = document.getElementById("profileRememberTask");
        const profileUseScreens = document.getElementById("profileUseScreens");
        const profileUseWebcam = document.getElementById("profileUseWebcam");
        const profileCardEmail = document.getElementById("profileCardEmail");
        const dropdownEmail = document.getElementById("dropdownEmail");

        if (profileEmail) profileEmail.value = data.email || "";
        if (profileContactEmail) profileContactEmail.value = data.email || "";
        if (profilePhone) profilePhone.value = data.phone || "";
        if (profileContactPhone) profileContactPhone.value = data.phone || "";
        if (profileContactNote) profileContactNote.value = data.contactNote || "";
        if (profilePersonalNote) profilePersonalNote.value = data.personalNote || "";
        if (profileNotifyUi) profileNotifyUi.checked = !!data.notifyInUi;
        if (profileRememberTask) profileRememberTask.checked = !!data.rememberLastTask;
        if (profileUseScreens) profileUseScreens.checked = !!data.allowScreenShots;
        if (profileUseWebcam) profileUseWebcam.checked = !!data.allowWebcamShots;
        if (profileCardEmail) profileCardEmail.textContent = data.email || "";
        if (dropdownEmail) dropdownEmail.textContent = data.email || "";

        enableScreenShots = !!data.allowScreenShots;
        enableWebcamShots = !!data.allowWebcamShots;

        const screenCheckbox = document.getElementById("enableScreenShots");
        const webcamCheckbox = document.getElementById("enableWebcamShots");

        if (screenCheckbox) screenCheckbox.checked = enableScreenShots;
        if (webcamCheckbox) webcamCheckbox.checked = enableWebcamShots;

        showNotification("Изменения сохранены");
    } catch {
        showNotification("Ошибка сети");
    }
}


function toggleStatusMenu(el) {
    const menu = el.nextElementSibling;
    if (!menu) return;

    const wasHidden = menu.classList.contains("hidden");

    document.querySelectorAll(".status-menu").forEach(x => {
        x.classList.add("hidden");
    });

    if (wasHidden) {
        menu.classList.remove("hidden");
    } else {
        menu.classList.add("hidden");
    }
}

function changeStatus(el, status) {
    const dropdown = el.closest(".status-dropdown");
    if (!dropdown) return;
        
    const badge = dropdown.querySelector(".status-badge");
    const statusInput = dropdown.querySelector(".employee-status-value");
    const menu = dropdown.querySelector(".status-menu");

    if (!badge || !statusInput || !menu) return;

    statusInput.value = status;

    badge.className = `status-badge ${getStatusBadgeClass(status)} task-status-badge`;
    badge.innerHTML = `
        <span class="status-badge-dot"></span>
        <span class="status-badge-text">${getStatusText(status)}</span>
        <i class="fas fa-chevron-down status-badge-arrow"></i>
    `;

    menu.classList.add("hidden");
}

