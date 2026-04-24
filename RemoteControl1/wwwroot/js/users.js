// Файл: RemoteControl1/wwwroot/js/users.js

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
    renderAdminStats();

    if (tabName === "employees") {
        renderUsersTable();
        return;
    }

    if (tabName === "workload") {
        renderWorkloadTable();
        return;
    }

    if (tabName === "productivity") {
        renderProductivityTable();
        return;
    }

    if (currentUserRole === "admin" && tabName === "salary") {
        renderSalaryTable();
        return;
    }

    if (currentUserRole === "admin" && tabName === "bonuses") {
        renderBonusesTable();
        return;
    }

    if (tabName === "control") {
        renderControlTab();
    }
}

function renderAdminStats() {
    const total = users.length;
    const active = users.filter(x => x.status === "active").length;
    const managers = users.filter(x => x.role === "manager").length;
    const admins = users.filter(x => x.role === "admin").length;

    const avgRate = total > 0
        ? Math.round(users.reduce((sum, x) => sum + Number(x.hourlyRate || 0), 0) / total)
        : 0;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
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

function escapeUserText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getCompactUserName(user) {
    const fullName = String(user?.fullName || user?.login || `ID ${user?.id || ""}`).trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.length > 2 ? `${parts[0]} ${parts[1]}` : fullName;
}

function getUserTooltip(user) {
    return [
        `ID: ${user?.id ?? "-"}`,
        `ФИО: ${user?.fullName || "-"}`,
        `Логин: ${user?.login || "-"}`,
        `Email: ${user?.email || "-"}`,
        `Должность: ${user?.position || "-"}`
    ].join("\n");
}

function renderUserIdCell(user) {
    const id = String(user?.id ?? "-");
    return `<span class="admin-user-id" title="ID ${escapeUserText(id)}">${escapeUserText(id)}</span>`;
}

function renderUserNameCell(user) {
    const email = user?.email || "";
    const tooltip = escapeUserText(getUserTooltip(user));
    return `
        <div class="admin-user-cell" title="${tooltip}">
            <strong class="admin-user-name">${escapeUserText(getCompactUserName(user))}</strong>
            ${email ? `<span class="admin-user-email">${escapeUserText(email)}</span>` : ""}
        </div>
    `;
}

function selectAdminTableRow(event, row) {
    if (!row) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions")) {
        return;
    }

    const table = row.closest("table");
    const wasSelected = row.classList.contains("is-selected");

    table?.querySelectorAll("tbody tr.is-selected").forEach(x => x.classList.remove("is-selected"));

    if (!wasSelected) {
        row.classList.add("is-selected");
    }
}

function enhanceAdminTables() {
    document.querySelectorAll("#usersPage .table th, #usersPage .table td").forEach(cell => {
        if (cell.title) return;

        const text = cell.textContent?.trim();
        if (text) {
            cell.title = text;
        }
    });
}

function clearEmployeeSearchAutofill() {
    const input = document.getElementById("employeeSearch");
    if (!input) return;

    if (input.dataset.userTouched === "1") {
        return;
    }

    const login = String(window.currentUserLogin || "").trim().toLowerCase();
    const value = String(input.value || "").trim().toLowerCase();

    if (value && login && value === login) {
        input.value = "";
        input.setAttribute("value", "");
        renderUsersTable();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const employeeSearch = document.getElementById("employeeSearch");
    if (!employeeSearch) return;

    employeeSearch.setAttribute("autocomplete", "off");
    employeeSearch.setAttribute("value", "");
    employeeSearch.dataset.userTouched = "0";

    ["input", "keydown", "paste"].forEach(eventName => {
        employeeSearch.addEventListener(eventName, () => {
            employeeSearch.dataset.userTouched = "1";
        });
    });

    [50, 300, 1000].forEach(delay => {
        window.setTimeout(clearEmployeeSearchAutofill, delay);
    });
});

function renderUsersTable() {
    const body = document.getElementById("usersTableBody");
    if (!body) return;

    clearEmployeeSearchAutofill();

    const data = getFilteredUsers();

    if (!data.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Сотрудники не найдены</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    const isAdminUser = currentUserRole === "admin";

    body.innerHTML = data.map(u => `
        <tr onclick="selectAdminTableRow(event, this)">
            <td>${renderUserIdCell(u)}</td>
            <td>${renderUserNameCell(u)}</td>
            <td title="${escapeUserText(u.login || "-")}">${escapeUserText(u.login || "-")}</td>
            <td title="${escapeUserText(u.position || "-")}">${escapeUserText(u.position || "-")}</td>
            <td>${getRoleBadge(u.role)}</td>
            <td>${Number(u.hourlyRate || 0).toLocaleString("ru-RU")} руб.</td>
            <td>${u.tasksInProgress}</td>
            <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
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
    `).join("");

    enhanceAdminTables();
}

function renderWorkloadTable() {
    const body = document.getElementById("workloadTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => `
        <tr onclick="selectAdminTableRow(event, this)">
            <td>${renderUserIdCell(u)}</td>
            <td>${renderUserNameCell(u)}</td>
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

    enhanceAdminTables();
}

function renderProductivityTable() {
    const body = document.getElementById("productivityTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
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
            <tr onclick="selectAdminTableRow(event, this)">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                <td>${u.tasksInProgress}</td>
                <td>${u.completedTasks}</td>
                <td>${index.toFixed(0)}%</td>
                <td><span class="badge ${badge}">${stateText}</span></td>
            </tr>
        `;
    }).join("");

    enhanceAdminTables();
}

function renderSalaryTable() {
    const body = document.getElementById("salaryTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const salaryHours = Number(u.salaryHours || 0);
        const workDayHours = Number(u.workDayHours || 0);
        const idleHours = Number(u.idleHours || 0);
        const rate = Number(u.hourlyRate || 0);
        const salary = salaryHours * rate;

        return `
            <tr onclick="selectAdminTableRow(event, this)">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td>${salaryHours.toFixed(1)}</td>
                <td>${workDayHours.toFixed(1)}</td>
                <td>${idleHours.toFixed(1)}</td>
                <td>${rate.toLocaleString("ru-RU")}</td>
                <td><strong>${salary.toLocaleString("ru-RU")}</strong></td>
            </tr>
        `;
    }).join("");

    enhanceAdminTables();
}

function renderBonusesTable() {
    const body = document.getElementById("bonusesTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const planned = Number(u.plannedHours || 0);
        const tracked = Number(u.trackedHours || 0);
        const diff = Number(u.workloadDiff || 0);
        const percent = Number(u.completionPercent || 0);
        const bonusPercent = Number(u.bonusPercent || 0);
        const bonusAmount = Number(u.bonusAmount || 0);
        const recommendation = bonusPercent > 0
            ? `Рекомендуется бонус ${bonusPercent}%`
            : "Без бонуса";

        return `
            <tr onclick="selectAdminTableRow(event, this)">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td>${planned.toFixed(1)}</td>
                <td>${tracked.toFixed(1)}</td>
                <td>${percent.toFixed(0)}%</td>
                <td>${diff >= 0 ? "+" : ""}${diff.toFixed(1)}</td>
                <td>
                    <div class="bonus-recommendation" title="${escapeUserText(recommendation)}">
                        <span class="badge ${bonusPercent > 0 ? "badge-success" : "badge-info"}">
                            ${escapeUserText(recommendation)}
                        </span>
                        <span class="bonus-amount">
                            ${bonusAmount > 0 ? `${bonusAmount.toLocaleString("ru-RU")} руб.` : "0 руб."}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    enhanceAdminTables();
}

function renderControlTab() {
    const overloaded = users.filter(u => u.productivityState === "overloaded");
    const underloaded = users.filter(u => u.productivityState === "underloaded");
    const noActivity = users.filter(u => Number(u.trackedHours || 0) <= 0);
    const highIdle = users.filter(u => Number(u.idleHours || 0) >= 2);

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
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

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Вид работы</label>
                <input class="form-control" value="${user.workMode === "fixed" ? "Фиксированный" : "Гибкий"}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Норма часов</label>
                <input class="form-control" value="${Number(user.requiredDailyHours || 0).toFixed(1)}" readonly>
            </div>
        </div>

        ${user.workMode === "fixed" ? `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Начало</label>
                    <input class="form-control" value="${user.plannedStartTime || "-"}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Конец</label>
                    <input class="form-control" value="${user.plannedEndTime || "-"}" readonly>
                </div>
            </div>
        ` : ``}

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

    openModal("userDetailsModal");
}

function openUserModal() {
    const title = document.getElementById("userModalTitle");
    const editId = document.getElementById("userEditId");
    const saveBtn = document.getElementById("saveUserBtn");

    if (title) title.textContent = "Новый сотрудник";
    if (editId) editId.value = "0";
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';

    resetUserModalState();
    openModal("userModal");
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
        if (el) {
            el.value = "";
        }
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
        if (el) {
            el.value = value;
        }
    });

    toggleWorkModeFields("u");
    toggleWorkModeFields("editU");
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

    if (dto.workMode === "flexible") {
        dto.plannedStartTime = "";
        dto.plannedEndTime = "";
    }

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
    openModal("editUserModal");
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

    if (dto.workMode === "flexible") {
        dto.plannedStartTime = "";
        dto.plannedEndTime = "";
    }

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

function exportAdminSalaryCsv() {
    const rows = [
        ["ФИО", "Оплачиваемые часы", "Ставка", "Сумма"],
        ...users.map(u => [
            u.fullName,
            Number(u.salaryHours || 0).toFixed(1),
            String(u.hourlyRate),
            String(Number(u.salaryHours || 0) * Number(u.hourlyRate || 0))
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
        enhanceAdminTables();
        return;
    }

    const canReview = isAdmin || isManager;

    body.innerHTML = manualTimeRequests.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canShowActions = canReview && status !== "approved" && status !== "rejected";

        return `
            <tr onclick="selectAdminTableRow(event, this)">
                <td>${escapeUserText(x.id)}</td>
                <td>${escapeUserText(x.employee || "-")}</td>
                <td>${escapeUserText(x.taskName || "-")}</td>
                <td>${escapeUserText(x.projectName || "-")}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${escapeUserText(x.comment || "-")}</td>
                <td>
                    ${x.attachmentPath
                ? `<a href="${escapeUserText(x.attachmentPath)}" target="_blank" class="btn btn-sm btn-outline manual-file-btn" title="${escapeUserText(x.attachmentName || "Файл")}">
                                 <i class="fas fa-paperclip"></i>
                            </a>`
                : `<span style="display:inline-block; width:100%; text-align:center;">-</span>`
            }
                </td>
                <td>${renderManualTimeStatus(status)}</td>
                <td title="${x.createdAt || "-"}">${formatManualRequestDate(x.createdAt)}</td>
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

    enhanceAdminTables();
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

function formatManualRequestDate(value) {
    if (!value) {
        return "-";
    }

    return `<span class="manual-date">${value}</span>`;
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

async function initProfilePage() {
    const roleText = getRoleText(currentUserRole);
    const statusText = getStatusTextFull(currentUserIsActive);
    const rateText = currentUserRate > 0 ? `${currentUserRate.toLocaleString("ru-RU")} руб.` : "—";

    const setProfileValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value || "";
        }
    };

    setProfileValue("profileFullName", currentUserName);
    setProfileValue("profileLogin", currentUserLogin);
    setProfileValue("profileEmail", currentUserEmail);
    setProfileValue("profileContactEmail", currentUserEmail);
    setProfileValue("profilePhone", currentUserPhone);
    setProfileValue("profileContactPhone", currentUserPhone);
    setProfileValue("profilePosition", currentUserPosition);

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
