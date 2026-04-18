
//users.js
function showAdminTab(tabName, btn) {
    if (currentUserRole !== "admin" && (tabName === "salary" || tabName === "bonuses")) {
        showNotification("Нет доступа");
        return;
    }

    document.querySelectorAll(".admin-tab-content").forEach(x => x.classList.add("hidden"));
    document.querySelectorAll(".admin-tab-btn").forEach(x => x.classList.remove("active"));

    const map = {
        employees: "adminEmployeesTab",
        workload: "adminWorkloadTab",
        productivity: "adminProductivityTab",
        salary: "adminSalaryTab",
        bonuses: "adminBonusesTab",
        control: "adminControlTab"
    };

    const target = document.getElementById(map[tabName]);
    if (target) {
        target.classList.remove("hidden");
    }

    if (btn) {
        btn.classList.add("active");
    }

    renderAdminSection(tabName);
}

function renderAdminSection(tabName) {
    renderUsersTable();
    renderAdminStats();

    if (tabName === "workload") renderWorkloadTable();
    if (tabName === "productivity") renderProductivityTable();

    if (currentUserRole === "admin") {
        if (tabName === "salary") renderSalaryTable();
        if (tabName === "bonuses") renderBonusesTable();
    }

    if (tabName === "control") renderControlTab();
    
}

function renderAdminStats() {
    const total = users.length;
    const active = users.filter(x => x.status === "active").length;
    const managers = users.filter(x => x.role === "manager").length;
    const admins = users.filter(x => x.role === "admin").length;
    const avgRate = total > 0
        ? Math.round(users.reduce((sum, x) => sum + x.hourlyRate, 0) / total)
        : 0;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    set("adminEmployeesTotal", total);
    set("adminEmployeesActive", active);
    set("adminManagersCount", managers);
    set("adminAdminsCount", admins);
    set("adminAverageRate", avgRate.toLocaleString("ru-RU"));
}

function getFilteredUsers() {
    const search = (document.getElementById("employeeSearch")?.value || "").toLowerCase();
    const role = document.getElementById("employeeRoleFilter")?.value || "all";
    const status = document.getElementById("employeeStatusFilter")?.value || "all";

    return users.filter(u => {
        const textMatch =
            (u.fullName || "").toLowerCase().includes(search) ||
            (u.login || "").toLowerCase().includes(search) ||
            (u.email || "").toLowerCase().includes(search);

        const roleMatch = role === "all" || u.role === role;
        const statusMatch = status === "all" || u.status === status;

        return textMatch && roleMatch && statusMatch;
    });
}

function renderUsersTable() {
    const body = document.getElementById("usersTableBody");
    if (!body) return;

    const data = getFilteredUsers();

    if (!data.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Сотрудники не найдены</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = data.map(u => {
        const isAdminUser = currentUserRole === "admin";

        return `
        <tr>
            <td>#${String(u.id).padStart(3, "0")}</td>
            <td>
                <strong>${u.fullName}</strong>
                <div style="font-size:12px; color:var(--gray); margin-top:4px;">${u.email || "без email"}</div>
            </td>
            <td>${u.login}</td>
            <td>${u.position || "-"}</td>
            <td>${getRoleBadge(u.role)}</td>
            <td>${Number(u.hourlyRate || 0).toLocaleString("ru-RU")} руб.</td>
            <td>${u.tasksInProgress}</td>
            <td>${Number(u.totalHours || 0).toFixed(1)}</td>
            <td>${getUserStatusBadge(u.status)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-sm btn-outline" onclick="showUserDetails(${u.id})" title="Карточка">
                        <i class="fas fa-eye"></i>
                    </button>

                    ${isAdminUser ? `
                        <button class="btn btn-sm btn-outline" onclick="editUser(${u.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm ${u.status === "active" ? "btn-danger" : "btn-success"}" onclick="toggleUserStatus(${u.id})" title="Статус">
                            <i class="fas ${u.status === "active" ? "fa-user-lock" : "fa-user-check"}"></i>
                        </button>
                    ` : ``}
                </div>
            </td>
        </tr>
    `;
    }).join("");
}

function renderWorkloadTable() {
    const body = document.getElementById("workloadTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map(u => `
        <tr>
            <td>${u.fullName}</td>
            <td>${u.tasksInProgress}</td>
            <td>${u.completedTasks}</td>
            <td>${u.overdueTasks}</td>
            <td>${Number(u.plannedHours || 0).toFixed(1)}</td>
            <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
            <td>${Number(u.workDayHours || 0).toFixed(1)}</td>
            <td>${Number(u.idleHours || 0).toFixed(1)}</td>
            <td>${Number(u.workloadDiff || 0) >= 0 ? "+" : ""}${Number(u.workloadDiff || 0).toFixed(1)}</td>
        </tr>
    `).join("");
}

function renderProductivityTable() {
    const body = document.getElementById("productivityTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map(u => {
        let stateText = "Норма";
        let badge = "badge-info";

        if (u.productivityState === "overloaded") {
            stateText = "Перегружен";
            badge = "badge-danger";
        } else if (u.productivityState === "underloaded") {
            stateText = "Недогружен";
            badge = "badge-warning";
        }

        const index = Number(u.completionPercent || 0);

        return `
            <tr>
                <td>${u.fullName}</td>
                <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                <td>${u.tasksInProgress}</td>
                <td>${u.completedTasks}</td>
                <td>${index.toFixed(0)}%</td>
                <td><span class="badge ${badge}">${stateText}</span></td>
            </tr>
        `;
    }).join("");
}

function renderSalaryTable() {
    const body = document.getElementById("salaryTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map(u => {
        const salaryHours = Number(u.salaryHours || 0);
        const workDayHours = Number(u.workDayHours || 0);
        const idleHours = Number(u.idleHours || 0);
        const rate = Number(u.hourlyRate || 0);
        const salary = salaryHours * rate;

        return `
            <tr>
                <td>${u.fullName}</td>
                <td>${salaryHours.toFixed(1)}</td>
                <td>${workDayHours.toFixed(1)}</td>
                <td>${idleHours.toFixed(1)}</td>
                <td>${rate.toLocaleString("ru-RU")}</td>
                <td><strong>${salary.toLocaleString("ru-RU")}</strong></td>
            </tr>
        `;
    }).join("");
}

function renderBonusesTable() {
    const body = document.getElementById("bonusesTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map(u => {
        const planned = Number(u.plannedHours || 0);
        const tracked = Number(u.trackedHours || 0);
        const diff = Number(u.workloadDiff || 0);
        const percent = Number(u.completionPercent || 0);
        const bonusPercent = Number(u.bonusPercent || 0);
        const bonusAmount = Number(u.bonusAmount || 0);

        return `
            <tr>
                <td>${u.fullName}</td>
                <td>${planned.toFixed(1)}</td>
                <td>${tracked.toFixed(1)}</td>
                <td>${percent.toFixed(0)}%</td>
                <td>${diff >= 0 ? "+" : ""}${diff.toFixed(1)}</td>
                <td>
    <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
        <span class="badge ${bonusPercent > 0 ? "badge-success" : "badge-info"}">
            ${bonusPercent > 0 ? `Бонус ${bonusPercent}%` : "Без бонуса"}
        </span>
        <span style="font-size:12px; color:var(--gray);">
            ${bonusAmount > 0 ? `${bonusAmount.toLocaleString("ru-RU")} руб.` : "0 руб."}
        </span>
    </div>
</td>
            </tr>
        `;
    }).join("");
}

function renderControlTab() {
    const overloaded = users.filter(u => u.productivityState === "overloaded");
    const underloaded = users.filter(u => u.productivityState === "underloaded");
    const noActivity = users.filter(u => Number(u.trackedHours || 0) <= 0);
    const highIdle = users.filter(u => Number(u.idleHours || 0) >= 2);

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    set("controlOverloaded", overloaded.length);
    set("controlUnderloaded", underloaded.length);
    set("controlNoActivity", noActivity.length);
    set("controlHighIdle", highIdle.length);

    const controlList = document.getElementById("controlList");
    if (!controlList) return;

    let html = "";

    if (overloaded.length) {
        html += `
            <div class="card" style="margin-bottom:16px;">
                <h4 style="margin-bottom:12px; color:var(--danger);">Перегружены</h4>
                ${overloaded.map(x => `<div style="margin-bottom:8px;">${x.fullName} — активных задач: ${x.tasksInProgress}, часов по задачам: ${Number(x.trackedHours || 0).toFixed(1)}</div>`).join("")}
            </div>
        `;
    }

    if (underloaded.length) {
        html += `
            <div class="card" style="margin-bottom:16px;">
                <h4 style="margin-bottom:12px; color:var(--warning);">Недогружены</h4>
                ${underloaded.map(x => `<div style="margin-bottom:8px;">${x.fullName} — часов по задачам: ${Number(x.trackedHours || 0).toFixed(1)} / ${Number(x.plannedHours || 0).toFixed(1)}</div>`).join("")}
            </div>
        `;
    }

    if (highIdle.length) {
        html += `
        <div class="card" style="margin-bottom:16px;">
            <h4 style="margin-bottom:12px; color:var(--warning);">Высокий простой</h4>
            ${highIdle.map(x => `<div style="margin-bottom:8px;">${x.fullName} — простой: ${Number(x.idleHours || 0).toFixed(1)} ч</div>`).join("")}
        </div>
    `;
    }

    if (noActivity.length) {
        html += `
            <div class="card" style="margin-bottom:0;">
                <h4 style="margin-bottom:12px; color:var(--primary);">Без активности</h4>
                ${noActivity.map(x => `<div style="margin-bottom:8px;">${x.fullName}</div>`).join("")}
            </div>
        `;
    }

    if (!html) {
        html = `<div style="color:var(--gray);">Отклонений пока нет</div>`;
    }

    controlList.innerHTML = html;
}
function openCalendarModal(date = null) {
    const title = document.getElementById("calendarTitle");
    const dateInput = document.getElementById("calendarDate");
    const time = document.getElementById("calendarTime");
    const description = document.getElementById("calendarDescription");

    if (title) title.value = "";
    if (dateInput) dateInput.value = date || selectedCalendarDate || new Date().toISOString().split("T")[0];
    if (time) time.value = "10:00";
    if (description) description.value = "";

    document.getElementById("calendarModal")?.classList.add("show");
}

function saveCalendarEvent() {
    const title = document.getElementById("calendarTitle")?.value.trim() || "";
    const date = document.getElementById("calendarDate")?.value || "";
    const time = document.getElementById("calendarTime")?.value || "";
    const description = document.getElementById("calendarDescription")?.value.trim() || "";

    if (!title || !date) {
        showNotification("Заполните название и дату");
        return;
    }

    calendarEvents.unshift({
        id: Date.now(),
        title,
        date,
        time,
        description
    });

    selectedCalendarDate = date;

    closeModal("calendarModal");
    showNotification("Событие добавлено");
}



function prevCalendarMonth() {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);

}

function nextCalendarMonth() {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);

}

function selectCalendarDate(date) {
    selectedCalendarDate = date;


}






function showUserDetails(id) {
    const user = users.find(x => x.id === id);
    if (!user) {
        showNotification("Сотрудник не найден");
        return;
    }

    const body = document.getElementById("userDetailsBody");
    if (!body) return;

    body.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">ФИО</label>
                <input class="form-control" value="${user.fullName}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Логин</label>
                <input class="form-control" value="${user.login}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-control" value="${user.email || ""}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Телефон</label>
                <input class="form-control" value="${user.phone || ""}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Должность</label>
                <input class="form-control" value="${user.position || ""}" readonly>
            </div>
            <div class="form-group">
    <label class="form-label">Роль</label>
    <input class="form-control" value="${getRoleText(user.role)}" readonly>
</div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Ставка</label>
                <input class="form-control" value="${user.hourlyRate}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Статус</label>
                <input class="form-control" value="${user.status === "active" ? "Активен" : "Заблокирован"}" readonly>
            </div>
        </div>

        <div class="stats-grid" style="margin-top:14px; margin-bottom:0;">
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${user.tasksInProgress}</div>
                    <div class="stat-label">Активных задач</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${user.completedTasks}</div>
                    <div class="stat-label">Выполнено задач</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${Number(user.trackedHours || 0).toFixed(1)}</div>
                    <div class="stat-label">Часов по задачам</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("userDetailsModal")?.classList.add("show");
}

function openUserModal() {
    const title = document.getElementById("userModalTitle");
    const rate = document.getElementById("uRate");
    const role = document.getElementById("uRole");
    const status = document.getElementById("uStatus");
    const modal = document.getElementById("userModal");
    const editId = document.getElementById("userEditId");
    const saveBtn = document.getElementById("saveUserBtn");

    if (title) title.textContent = "Новый сотрудник";
    if (editId) editId.value = "0";
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';

    [
        "uLastName",
        "uFirstName",
        "uMiddleName",
        "uLogin",
        "uPass",
        "uPass2",
        "uPosition",
        "uEmail",
        "uPhone",
        "uPlannedStartTime",
        "uPlannedEndTime"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    if (rate) rate.value = 1500;
    if (role) role.value = "employee";
    if (status) status.value = "active";

    const workMode = document.getElementById("uWorkMode");
    const requiredDailyHours = document.getElementById("uRequiredDailyHours");

    if (workMode) workMode.value = "fixed";
    if (requiredDailyHours) requiredDailyHours.value = 8;

    toggleWorkModeFields("u");

    if (modal) {
        modal.classList.add("show");
        modal.style.display = "flex";
    }
}

async function saveUser() {
    const editId = Number(document.getElementById("userEditId")?.value || 0);

    const dto = {
        id: editId,
        lastName: document.getElementById("uLastName")?.value.trim() || "",
        firstName: document.getElementById("uFirstName")?.value.trim() || "",
        middleName: document.getElementById("uMiddleName")?.value.trim() || "",
        login: document.getElementById("uLogin")?.value.trim() || "",
        password: document.getElementById("uPass")?.value || "",
        position: document.getElementById("uPosition")?.value.trim() || "",
        rate: Number(document.getElementById("uRate")?.value || 0),
        role: document.getElementById("uRole")?.value || "employee",
        email: document.getElementById("uEmail")?.value.trim() || "",
        phone: document.getElementById("uPhone")?.value.trim() || "",
        status: document.getElementById("uStatus")?.value || "active",
        workMode: document.getElementById("uWorkMode")?.value || "fixed",
        requiredDailyHours: Number(document.getElementById("uRequiredDailyHours")?.value || 8),
        plannedStartTime: document.getElementById("uPlannedStartTime")?.value || "",
        plannedEndTime: document.getElementById("uPlannedEndTime")?.value || ""
    };

    const pass2 = document.getElementById("uPass2")?.value || "";

    if (!dto.lastName || !dto.firstName || !dto.login || !dto.position) {
        showNotification("Заполните обязательные поля");
        return;
    }

    if (editId === 0 && !dto.password) {
        showNotification("Введите пароль");
        return;
    }

    if ((dto.password || pass2) && dto.password !== pass2) {
        showNotification("Пароли не совпадают");
        return;
    }

    if (!Number.isFinite(dto.rate) || dto.rate < 0) {
        showNotification("Некорректная ставка");
        return;
    }

    const handler = editId === 0 ? "AddUser" : "UpdateUser";

    try {
        const res = await fetch(`/MainPage?handler=${handler}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сохранения сотрудника");
            return;
        }

        const savedUser = normalizeUser(data.user);

        if (editId === 0) {
            users.unshift(savedUser);
        } else {
            const index = users.findIndex(u => Number(u.id) === Number(savedUser.id));
            if (index !== -1) {
                users[index] = savedUser;
            }
        }

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        closeModal("userModal");
        resetUserModalState();
        showNotification(editId === 0 ? "Сотрудник добавлен" : "Сотрудник обновлён");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function editUser(id) {
    const user = users.find(x => x.id === id);
    if (!user) {
        showNotification("Сотрудник не найден");
        return;
    }

    resetUserModalState();

    const modal = document.getElementById("editUserModal");
    if (!modal) return;

    document.getElementById("editUserId").value = user.id;
    document.getElementById("editULastName").value = extractLastName(user.fullName);
    document.getElementById("editUFirstName").value = extractFirstName(user.fullName);
    document.getElementById("editUMiddleName").value = extractMiddleName(user.fullName);
    document.getElementById("editULogin").value = user.login || "";
    document.getElementById("editUPass").value = "";
    document.getElementById("editUPosition").value = user.position || "";
    document.getElementById("editURate").value = user.hourlyRate || 0;
    document.getElementById("editURole").value = user.role || "employee";
    document.getElementById("editUEmail").value = user.email || "";
    document.getElementById("editUPhone").value = user.phone || "";
    document.getElementById("editUStatus").value = user.status || "active";
    document.getElementById("editUWorkMode").value = user.workMode || "fixed";
    document.getElementById("editURequiredDailyHours").value = user.requiredDailyHours || 8;
    document.getElementById("editUPlannedStartTime").value = user.plannedStartTime || "09:00";
    document.getElementById("editUPlannedEndTime").value = user.plannedEndTime || "18:00";

    toggleWorkModeFields("editU");

    modal.classList.add("show");
    modal.style.display = "flex";
}

function resetUserModalState() {
    [
        "userEditId",
        "uLastName",
        "uFirstName",
        "uMiddleName",
        "uLogin",
        "uPass",
        "uPass2",
        "uPosition",
        "uEmail",
        "uPhone",
        "uPlannedStartTime",
        "uPlannedEndTime",
        "editUserId",
        "editULastName",
        "editUFirstName",
        "editUMiddleName",
        "editULogin",
        "editUPass",
        "editUPosition",
        "editUEmail",
        "editUPhone",
        "editUPlannedStartTime",
        "editUPlannedEndTime"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const defaults = [
        ["uRate", 1500],
        ["uRole", "employee"],
        ["uStatus", "active"],
        ["uWorkMode", "fixed"],
        ["uRequiredDailyHours", 8],
        ["uPlannedStartTime", "09:00"],
        ["uPlannedEndTime", "18:00"],

        ["editURate", 1500],
        ["editURole", "employee"],
        ["editUStatus", "active"],
        ["editUWorkMode", "fixed"],
        ["editURequiredDailyHours", 8],
        ["editUPlannedStartTime", "09:00"],
        ["editUPlannedEndTime", "18:00"]
    ];

    defaults.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    toggleWorkModeFields("u");
    toggleWorkModeFields("editU");
}


async function saveUserChanges() {
    const dto = {
        id: Number(document.getElementById("editUserId")?.value || 0),
        lastName: document.getElementById("editULastName")?.value.trim() || "",
        firstName: document.getElementById("editUFirstName")?.value.trim() || "",
        middleName: document.getElementById("editUMiddleName")?.value.trim() || "",
        login: document.getElementById("editULogin")?.value.trim() || "",
        password: document.getElementById("editUPass")?.value || "",
        position: document.getElementById("editUPosition")?.value.trim() || "",
        rate: Number(document.getElementById("editURate")?.value || 0),
        role: document.getElementById("editURole")?.value || "employee",
        email: document.getElementById("editUEmail")?.value.trim() || "",
        phone: document.getElementById("editUPhone")?.value.trim() || "",
        status: document.getElementById("editUStatus")?.value || "active",
        workMode: document.getElementById("editUWorkMode")?.value || "fixed",
        requiredDailyHours: Number(document.getElementById("editURequiredDailyHours")?.value || 8),
        plannedStartTime: document.getElementById("editUPlannedStartTime")?.value || "",
        plannedEndTime: document.getElementById("editUPlannedEndTime")?.value || ""
    };

    if (!dto.lastName || !dto.firstName || !dto.login || !dto.position) {
        showNotification("Заполните обязательные поля");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=UpdateUser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сохранения");
            return;
        }

        const index = users.findIndex(x => x.id === dto.id);
        if (index !== -1) {
            users[index] = normalizeUser(data.user);
        }

        closeModal("editUserModal");
        resetUserModalState();

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        showNotification("Изменения сохранены");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}


function toggleWorkModeFields(prefix) {
    const mode = document.getElementById(`${prefix}WorkMode`)?.value || "fixed";
    const box = document.getElementById(`${prefix}FixedWorkFields`);
    if (!box) return;

    if (mode === "fixed") {
        box.classList.remove("hidden");
    } else {
        box.classList.add("hidden");
    }
}



async function toggleUserStatus(id) {
    try {
        const res = await fetch("/MainPage?handler=ToggleUserStatus", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ id: id })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка изменения статуса");
            return;
        }

        const index = users.findIndex(x => x.id === id);
        if (index !== -1) {
            users[index] = normalizeUser(data.user);
        }

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        showNotification("Статус обновлен");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function resetUserPassword(id) {
    showNotification(`Сброс пароля для #${id}`);
}

function exportAdminSalaryCsv() {
    const rows = [
        ["ФИО", "Оплачиваемые часы", "Ставка", "Сумма"],
        ...users.map(u => [
            u.fullName,
            u.salaryHours.toFixed(1),
            String(u.hourlyRate),
            String(u.salaryHours * u.hourlyRate)
        ])
    ];

    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "salary-report.csv";
    link.click();

    URL.revokeObjectURL(url);
}