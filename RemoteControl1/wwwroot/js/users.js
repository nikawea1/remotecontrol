// Файл: RemoteControl1/wwwroot/js/users.js

let manualTimeRequests = Array.isArray(window.manualTimeRequests) ? window.manualTimeRequests : [];
let expandedManualRequestId = 0;

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

function parseManualRequestDateValue(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);

    if (!match) {
        return null;
    }

    const [, dd, mm, yyyy, hh = "00", min = "00"] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

function getManualRequestDateParts(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return { date: "—", time: "" };
    }

    const [datePart, timePart = ""] = raw.split(/\s+/);
    return {
        date: datePart || "—",
        time: timePart
    };
}

function getManualRequestStatusText(status) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "Одобрено";
        case "rejected":
            return "Отклонено";
        case "needs_revision":
            return "На доработке";
        default:
            return "Ожидание";
    }
}

function getManualRequestStatusOrder(status) {
    switch (String(status || "").toLowerCase()) {
        case "pending":
            return 1;
        case "needs_revision":
            return 2;
        case "approved":
            return 3;
        case "rejected":
            return 4;
        default:
            return 9;
    }
}

function refreshManualRequestFilters() {
    const projectFilter = document.getElementById("manualRequestProjectFilter");
    const reasonFilter = document.getElementById("manualRequestReasonFilter");

    if (projectFilter) {
        const current = projectFilter.value || "all";
        const options = [...new Set(
            manualTimeRequests
                .map(x => String(x.projectName || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));

        projectFilter.innerHTML = `
            <option value="all">Все проекты</option>
            ${options.map(name => `<option value="${escapeUserText(name)}">${escapeUserText(name)}</option>`).join("")}
        `;

        projectFilter.value = options.includes(current) ? current : "all";
    }

    if (reasonFilter) {
        const current = reasonFilter.value || "all";
        const options = [...new Set(
            manualTimeRequests
                .map(x => String(x.reason || "").trim().toLowerCase())
                .filter(Boolean)
        )].sort((a, b) => getManualRequestReasonText(a).localeCompare(getManualRequestReasonText(b), "ru"));

        reasonFilter.innerHTML = `
            <option value="all">Все причины</option>
            ${options.map(value => `<option value="${escapeUserText(value)}">${escapeUserText(getManualRequestReasonText(value))}</option>`).join("")}
        `;

        reasonFilter.value = options.includes(current) ? current : "all";
    }
}

function resetManualRequestFilters() {
    const search = document.getElementById("manualRequestSearch");
    const status = document.getElementById("manualRequestStatusFilter");
    const reason = document.getElementById("manualRequestReasonFilter");
    const project = document.getElementById("manualRequestProjectFilter");
    const sort = document.getElementById("manualRequestSortFilter");

    if (search) search.value = "";
    if (status) status.value = "all";
    if (reason) reason.value = "all";
    if (project) project.value = "all";
    if (sort) sort.value = "newest";

    renderManualTimeRequests();
}

function getFilteredManualTimeRequests() {
    const search = String(document.getElementById("manualRequestSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("manualRequestStatusFilter")?.value || "all";
    const reason = document.getElementById("manualRequestReasonFilter")?.value || "all";
    const project = document.getElementById("manualRequestProjectFilter")?.value || "all";
    const sort = document.getElementById("manualRequestSortFilter")?.value || "newest";

    const filtered = manualTimeRequests.filter(item => {
        const statusMatch = status === "all" || String(item.status || "").toLowerCase() === status;
        const reasonMatch = reason === "all" || String(item.reason || "").toLowerCase() === reason;
        const projectMatch = project === "all" || String(item.projectName || "") === project;
        const text = [
            item.employee,
            item.taskName,
            item.projectName,
            item.comment,
            getManualRequestReasonText(item.reason),
            item.status
        ].join(" ").toLowerCase();
        const searchMatch = !search || text.includes(search);

        return statusMatch && reasonMatch && projectMatch && searchMatch;
    });

    filtered.sort((a, b) => {
        if (sort === "oldest" || sort === "newest") {
            const aTime = parseManualRequestDateValue(a.createdAt)?.getTime() || 0;
            const bTime = parseManualRequestDateValue(b.createdAt)?.getTime() || 0;
            return sort === "oldest" ? aTime - bTime : bTime - aTime;
        }

        if (sort === "hours_asc" || sort === "hours_desc") {
            const diff = Number(a.hours || 0) - Number(b.hours || 0);
            return sort === "hours_asc" ? diff : -diff;
        }

        if (sort === "status") {
            const statusDiff = getManualRequestStatusOrder(a.status) - getManualRequestStatusOrder(b.status);
            if (statusDiff !== 0) {
                return statusDiff;
            }
        }

        return (parseManualRequestDateValue(b.createdAt)?.getTime() || 0) - (parseManualRequestDateValue(a.createdAt)?.getTime() || 0);
    });

    return filtered;
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
        if (cell.closest(".manual-request-expanded-row")) return;
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

    const getProductivityStateView = (state) => {
        if (state === "overloaded") {
            return { text: "Перегружен", badge: "badge-danger" };
        }

        if (state === "underloaded") {
            return { text: "Недогружен", badge: "badge-warning" };
        }

        if (state === "no_data") {
            return { text: "Нет данных", badge: "badge-info" };
        }

        return { text: "Норма", badge: "badge-success" };
    };

    body.innerHTML = users.map(u => {
        const stateView = getProductivityStateView(u.productivityState);
        const index = Number(u.completionPercent || 0);

        return `
              <tr onclick="selectAdminTableRow(event, this)">
                  <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                  <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                  <td>${u.tasksInProgress}</td>
                  <td>${u.completedTasks}</td>
                  <td>${index.toFixed(0)}%</td>
                  <td><span class="badge ${stateView.badge}">${stateView.text}</span></td>
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
                <td colspan="9" style="text-align:center; color: var(--gray);">Нет данных</td>
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
        const reason = String(u.bonusReason || "").trim();
        const statusText = bonusPercent > 0
            ? `Бонус ${bonusPercent}%`
            : "Без бонуса";
        const badgeClass = bonusPercent >= 10
            ? "badge-success"
            : bonusPercent > 0
                ? "badge-warning"
                : "badge-info";

        return `
              <tr onclick="selectAdminTableRow(event, this)">
                  <td>${renderUserIdCell(u)}</td>
                  <td>${renderUserNameCell(u)}</td>
                  <td>${planned.toFixed(1)}</td>
                  <td>${tracked.toFixed(1)}</td>
                  <td>${percent.toFixed(0)}%</td>
                  <td>${diff >= 0 ? "+" : ""}${diff.toFixed(1)}</td>
                  <td><span class="badge ${badgeClass}">${escapeUserText(statusText)}</span></td>
                  <td class="bonus-reason-cell" title="${escapeUserText(reason || "Бонус не назначен")}">${escapeUserText(reason || "Бонус не назначен")}</td>
                  <td class="bonus-amount-cell">${bonusAmount > 0 ? `${bonusAmount.toLocaleString("ru-RU")} руб.` : "0 руб."}</td>
              </tr>
          `;
    }).join("");

    enhanceAdminTables();
}

function renderControlTab() {
    const overloaded = users.filter(u => u.productivityState === "overloaded");
    const underloaded = users.filter(u => u.productivityState === "underloaded");
    const noActivity = users.filter(u =>
        Number(u.trackedHours || 0) <= 0 &&
        (Number(u.tasksInProgress || 0) > 0 || Number(u.plannedHours || 0) > 0 || Number(u.workDayHours || 0) > 0));
    const highIdle = users.filter(u =>
        Number(u.workDayHours || 0) > 0 &&
        Number(u.idleHours || 0) >= 2);

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
        refreshManualRequestFilters();
        if (expandedManualRequestId && !getManualRequestById(expandedManualRequestId)) {
            expandedManualRequestId = 0;
        }
        renderManualTimeRequests();
        renderDashboardManualTimeRequests();
    } catch {
        showNotification("Ошибка загрузки заявок");
    }
}

function getManualRequestReasonText(reason) {
    switch (String(reason || "").toLowerCase()) {
        case "forgot_timer":
            return "Забыл запустить таймер";
        case "after_completion":
            return "После завершения";
        case "technical_issue":
            return "Техническая проблема";
        case "external_work":
            return "Созвон / внешняя работа";
        case "meeting":
            return "Встреча / митап";
        case "offline_work":
            return "Оффлайн работа";
        case "fix_after_pause":
            return "Доработка после паузы";
        case "customer_help":
            return "Помощь клиенту";
        case "review_help":
            return "Проверка / помощь коллеге";
        case "migration":
            return "Перенос / настройка";
        case "other":
            return "Другое";
        default:
            return reason || "—";
    }
}

function getManualRequestById(id) {
    return manualTimeRequests.find(x => Number(x.id) === Number(id));
}

function renderManualRequestPreview(x) {
    const reasonText = escapeUserText(getManualRequestReasonText(x.reason));
    const commentText = escapeUserText(x.comment || "—");

    return `
        <div class="manual-request-preview">
            <span class="manual-request-preview-reason" title="${reasonText}">${reasonText}</span>
            <span class="manual-request-preview-comment" title="${commentText}">${commentText}</span>
        </div>
    `;
}

function renderManualTimeStatus(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "approved") {
        return `<span class="task-status status-done manual-request-status-badge">Одобрено</span>`;
    }

    if (normalized === "rejected") {
        return `<span class="task-status status-new manual-request-status-badge">Отклонено</span>`;
    }

    if (normalized === "needs_revision") {
        return `<span class="task-status status-review manual-request-status-badge">На доработке</span>`;
    }

    return `<span class="task-status status-review manual-request-status-badge">Ожидание</span>`;
}

function formatManualRequestDate(value) {
    const parts = getManualRequestDateParts(value);
    return `
        <span class="manual-date">
            <span class="manual-date-day">${escapeUserText(parts.date)}</span>
            <span class="manual-date-time">${escapeUserText(parts.time || "—")}</span>
        </span>
    `;
}

function formatManualRequestTimelineDate(value) {
    const parts = getManualRequestDateParts(value);
    return `
        <span class="manual-request-timeline-date">
            <strong>${escapeUserText(parts.date)}</strong>
            <span>${escapeUserText(parts.time || "—")}</span>
        </span>
    `;
}

function getManualRequestStateInfo(request) {
    const status = String(request.status || "pending").toLowerCase();

    switch (status) {
        case "approved":
            return {
                title: "Время подтверждено",
                text: "Заявка одобрена. Эти часы могут участвовать в расчётах, отчётах и бонусах.",
                tone: "success",
                actionText: "Дополнительных действий не требуется."
            };
        case "rejected":
            return {
                title: "Заявка отклонена",
                text: "Заявка закрыта и не учитывается в расчётах. При необходимости сотрудник может создать новую заявку с уточнениями.",
                tone: "danger",
                actionText: "Проверь комментарий менеджера и при необходимости подготовь новую заявку."
            };
        case "needs_revision":
            return {
                title: "Нужна доработка",
                text: "Менеджер вернул заявку на доработку. После исправления её можно отправить повторно.",
                tone: "warning",
                actionText: "Исправь замечания, обнови комментарий или файл и отправь заявку снова."
            };
        default:
            return {
                title: "Ожидает решения",
                text: "Заявка отправлена и пока находится на проверке у менеджера.",
                tone: "info",
                actionText: "Ожидается решение: одобрение, возврат на доработку или отклонение."
            };
    }
}

function getManualRequestHistoryMarkup(request) {
    const status = String(request.status || "pending").toLowerCase();
    const items = [
        {
            title: "Заявка создана",
            time: request.createdAt || "—",
            icon: "fa-file-circle-plus",
            tone: "info",
            text: `Сотрудник отправил заявку на ${Number(request.hours || 0).toFixed(1)} ч по задаче «${escapeUserText(request.taskName || "—")}».`
        }
    ];

    if (request.reviewedAt) {
        const reviewText = escapeUserText(request.managerComment || "");
        const actionTitle =
            status === "approved"
                ? "Заявка одобрена"
                : status === "rejected"
                    ? "Заявка отклонена"
                    : status === "needs_revision"
                        ? "Возвращена на доработку"
                        : "Заявка проверена";

        const actionText =
            reviewText ||
            (status === "approved"
                ? "Менеджер подтвердил учёт времени."
                : status === "rejected"
                    ? "Менеджер отклонил заявку."
                    : status === "needs_revision"
                        ? "Менеджер запросил доработку и уточнение."
                        : "Статус заявки был обновлён.");

        items.push({
            title: actionTitle,
            time: request.reviewedAt,
            icon:
                status === "approved"
                    ? "fa-circle-check"
                    : status === "rejected"
                        ? "fa-circle-xmark"
                        : status === "needs_revision"
                            ? "fa-rotate-left"
                            : "fa-clipboard-check",
            tone:
                status === "approved"
                    ? "success"
                    : status === "rejected"
                        ? "danger"
                        : status === "needs_revision"
                            ? "warning"
                            : "info",
            text: actionText
        });
    }

    if (status === "pending") {
        items.push({
            title: "Ожидает решения",
            time: request.createdAt || "—",
            icon: "fa-hourglass-half",
            tone: "pending",
            text: "Заявка отправлена на проверку и пока не обработана менеджером."
        });
    }

    return `
        <div class="manual-request-timeline">
            ${items.map((item, index) => `
                <div class="manual-request-timeline-item is-${item.tone}">
                    <div class="manual-request-timeline-marker">
                        <span class="manual-request-timeline-dot">
                            <i class="fas ${item.icon}"></i>
                        </span>
                        ${index < items.length - 1 ? `<span class="manual-request-timeline-line"></span>` : ""}
                    </div>
                    <div class="manual-request-timeline-content">
                        <div class="manual-request-timeline-head">
                            <strong>${item.title}</strong>
                            ${formatManualRequestTimelineDate(item.time)}
                        </div>
                        <div class="manual-request-timeline-text">${item.text}</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderManualRequestExpandedDetails(request) {
    const attachmentMarkup = request.attachmentPath
        ? `<a href="${escapeUserText(request.attachmentPath)}" target="_blank" class="btn btn-outline manual-expanded-file-btn">
                <i class="fas fa-paperclip"></i> ${escapeUserText(request.attachmentName || "Открыть файл")}
           </a>`
        : `<span class="manual-request-muted">Файл не прикреплён</span>`;
    const statusMarkup = renderManualTimeStatus(request.status);
    const stateInfo = getManualRequestStateInfo(request);
    const canResubmitAction = request.canResubmit
        ? `
            <button class="btn btn-primary" type="button" onclick="closeModal('manualRequestDetailsModal'); startManualRequestEdit(${request.id})">
                <i class="fas fa-rotate-left"></i> Исправить и отправить снова
            </button>
        `
        : "";

    return `
        <div class="manual-request-modal-shell">
            <div class="manual-request-modal-top">
                <div class="manual-request-modal-heading">
                    <div class="manual-request-modal-kicker">Заявка #${escapeUserText(request.id)}</div>
                    <h4>Ручное время по задаче «${escapeUserText(request.taskName || "—")}»</h4>
                    <div class="manual-request-modal-meta">
                        <span>${escapeUserText(request.employee || "—")}</span>
                        <span>${escapeUserText(request.projectName || "Без проекта")}</span>
                    </div>
                </div>
                <div class="manual-request-modal-status">
                    ${statusMarkup}
                    <div class="manual-request-modal-status-caption">${stateInfo.title}</div>
                </div>
            </div>

            <div class="manual-request-summary-grid">
                <div class="manual-request-summary-chip">
                    <span>Дата работы</span>
                    <strong>${escapeUserText(request.workDate || "—")}</strong>
                </div>
                <div class="manual-request-summary-chip">
                    <span>Учтённые часы</span>
                    <strong>${Number(request.hours || 0).toFixed(1)} ч</strong>
                </div>
                <div class="manual-request-summary-chip">
                    <span>Отправлена</span>
                    <strong>${escapeUserText(request.createdAt || "—")}</strong>
                </div>
                <div class="manual-request-summary-chip">
                    <span>Последняя проверка</span>
                    <strong>${escapeUserText(request.reviewedAt || "—")}</strong>
                </div>
            </div>

            <div class="manual-request-modal-tabs" role="tablist" aria-label="Вкладки заявки">
                <button class="manual-request-modal-tab is-active" type="button" data-tab="overview" onclick="switchManualRequestDetailsTab(event, 'overview')">
                    Обзор
                </button>
                <button class="manual-request-modal-tab" type="button" data-tab="review" onclick="switchManualRequestDetailsTab(event, 'review')">
                    Проверка
                </button>
                <button class="manual-request-modal-tab" type="button" data-tab="history" onclick="switchManualRequestDetailsTab(event, 'history')">
                    История
                </button>
            </div>

            <div class="manual-request-modal-panel is-active" data-tab-panel="overview">
                <div class="manual-request-modal-grid">
                    <div class="manual-request-modal-card">
                        <h5>Основная информация</h5>
                        <div class="manual-request-modal-list">
                            <div class="manual-request-modal-item"><span>Сотрудник</span><strong>${escapeUserText(request.employee || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Задача</span><strong>${escapeUserText(request.taskName || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Проект</span><strong>${escapeUserText(request.projectName || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Причина</span><strong>${escapeUserText(getManualRequestReasonText(request.reason))}</strong></div>
                            <div class="manual-request-modal-item"><span>Дата работы</span><strong>${escapeUserText(request.workDate || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Часы</span><strong>${Number(request.hours || 0).toFixed(1)} ч</strong></div>
                        </div>
                    </div>

                    <div class="manual-request-modal-card">
                        <h5>Подтверждение и файл</h5>
                        <div class="manual-request-modal-list">
                            <div class="manual-request-modal-item"><span>Файл</span><div>${attachmentMarkup}</div></div>
                            <div class="manual-request-modal-item"><span>Текущий статус</span><div>${statusMarkup}</div></div>
                            <div class="manual-request-modal-item"><span>Статус проверки</span><strong>${stateInfo.title}</strong></div>
                            <div class="manual-request-modal-item"><span>Что дальше</span><strong>${escapeUserText(stateInfo.actionText)}</strong></div>
                        </div>
                    </div>
                </div>

                <div class="manual-request-modal-note-grid">
                    <div class="manual-request-modal-card manual-request-modal-notes">
                        <h5>Что сделал сотрудник</h5>
                        <div class="manual-request-note-block">
                            <span>Комментарий</span>
                            <div>${escapeUserText(request.comment || "—")}</div>
                        </div>
                    </div>

                    <div class="manual-request-modal-card manual-request-modal-notes">
                        <h5>Комментарий менеджера</h5>
                        <div class="manual-request-note-block">
                            <span>Решение / замечание</span>
                            <div>${escapeUserText(request.managerComment || "Пока нет")}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="manual-request-modal-panel" data-tab-panel="review">
                <div class="manual-request-modal-grid">
                    <div class="manual-request-modal-card manual-request-state-card is-${stateInfo.tone}">
                        <h5>Состояние заявки</h5>
                        <div class="manual-request-state-header">
                            ${statusMarkup}
                            <strong>${stateInfo.title}</strong>
                        </div>
                        <p>${escapeUserText(stateInfo.text)}</p>
                        <div class="manual-request-state-hint">${escapeUserText(stateInfo.actionText)}</div>
                        ${canResubmitAction ? `<div class="manual-request-state-actions">${canResubmitAction}</div>` : ""}
                    </div>

                    <div class="manual-request-modal-card">
                        <h5>Контрольные точки</h5>
                        <div class="manual-request-modal-list">
                            <div class="manual-request-modal-item"><span>Отправлена</span><strong>${escapeUserText(request.createdAt || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Последняя проверка</span><strong>${escapeUserText(request.reviewedAt || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Дата работы</span><strong>${escapeUserText(request.workDate || "—")}</strong></div>
                            <div class="manual-request-modal-item"><span>Файл-подтверждение</span><div>${attachmentMarkup}</div></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="manual-request-modal-panel" data-tab-panel="history">
                <div class="manual-request-modal-card">
                    <h5>История правок и решений</h5>
                    ${getManualRequestHistoryMarkup(request)}
                </div>
            </div>
        </div>
    `;
}

function renderManualRequestExpandedSummary(request, showViewButton) {
    if (!showViewButton) {
        return "";
    }

    return `
        <div class="manual-request-expand-strip row-expand-animate">
            <button class="btn btn-sm btn-outline manual-request-expand-btn" type="button" onclick="showManualRequestDetails(${request.id})">
                <i class="fas fa-eye manual-request-expand-icon"></i>
                <span>Открыть подробности</span>
            </button>
        </div>
    `;
}

function toggleManualRequestRow(event, row, id) {
    if (!row) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions, .manual-file-btn")) {
        return;
    }

    const wasExpanded = Number(expandedManualRequestId) === Number(id);
    expandedManualRequestId = wasExpanded ? 0 : Number(id);
    renderManualTimeRequests();
}

function renderManualTimeRequests() {
    const body = document.getElementById("manualTimeRequestsBody");
    if (!body) return;

    const items = getFilteredManualTimeRequests();

    if (!items.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Заявок пока нет</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    const canReview = isAdmin || isManager;
    body.innerHTML = items.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canShowActions = canReview && status === "pending";
        const isExpanded = Number(expandedManualRequestId) === Number(x.id);
        const actionsMarkup = `
            <div class="table-actions manual-request-actions">
                ${canShowActions ? `
                    <button class="btn btn-sm btn-success" type="button" onclick="approveManualTimeRequest(${x.id})" title="Одобрить">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" type="button" onclick="sendManualTimeRequestToRevision(${x.id})" title="Вернуть на доработку">
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="rejectManualTimeRequest(${x.id})" title="Отклонить">
                        <i class="fas fa-times"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-outline" type="button" onclick="showManualRequestDetails(${x.id})" title="Подробнее">
                        <i class="fas fa-eye"></i>
                    </button>
                `}
            </div>
        `;

        return `
            <tr class="manual-request-row ${isExpanded ? "is-selected" : ""}" onclick="toggleManualRequestRow(event, this, ${x.id})">
                <td>${escapeUserText(x.id)}</td>
                <td title="${escapeUserText(x.employee || "-")}">${escapeUserText(x.employee || "-")}</td>
                <td title="${escapeUserText(x.taskName || "-")}">${escapeUserText(x.taskName || "-")}</td>
                <td title="${escapeUserText(x.projectName || "-")}">${escapeUserText(x.projectName || "-")}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${renderManualRequestPreview(x)}</td>
                <td class="manual-request-file-cell">
                    ${x.attachmentPath
                ? `<a href="${escapeUserText(x.attachmentPath)}" target="_blank" class="btn btn-sm btn-outline manual-file-btn" title="${escapeUserText(x.attachmentName || "Файл")}">
                                 <i class="fas fa-paperclip"></i>
                            </a>`
                : `<span class="manual-request-muted">—</span>`
            }
                </td>
                <td>${renderManualTimeStatus(status)}</td>
                <td>${formatManualRequestDate(x.createdAt)}</td>
                <td>${actionsMarkup}</td>
            </tr>
            ${isExpanded && canShowActions ? `
                <tr class="manual-request-expanded-row">
                    <td colspan="10">${renderManualRequestExpandedSummary(x, canShowActions)}</td>
                </tr>
            ` : ""}
        `;
    }).join("");

    enhanceAdminTables();
}

function showManualRequestDetails(id) {
    const request = getManualRequestById(id);
    const body = document.getElementById("manualRequestDetailsBody");
    if (!request || !body) {
        showNotification("Заявка не найдена");
        return;
    }

    body.innerHTML = renderManualRequestExpandedDetails(request);
    openModal("manualRequestDetailsModal");
}

function switchManualRequestDetailsTab(event, tabName) {
    const modal = document.getElementById("manualRequestDetailsModal");
    if (!modal) {
        return;
    }

    modal.querySelectorAll(".manual-request-modal-tab").forEach(tab => {
        tab.classList.toggle("is-active", tab.dataset.tab === tabName);
    });

    modal.querySelectorAll(".manual-request-modal-panel").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
    });

    if (event?.currentTarget instanceof HTMLElement) {
        event.currentTarget.blur();
    }
}

function openManualRequestActionModal(id, actionType) {
    const request = getManualRequestById(id);
    const title = document.getElementById("manualRequestActionTitle");
    const label = document.getElementById("manualRequestActionLabel");
    const hint = document.getElementById("manualRequestActionHint");
    const textarea = document.getElementById("manualRequestActionComment");
    const submitBtn = document.getElementById("manualRequestActionSubmitBtn");
    const idField = document.getElementById("manualRequestActionId");
    const typeField = document.getElementById("manualRequestActionType");

    if (!request || !title || !label || !hint || !textarea || !submitBtn || !idField || !typeField) {
        showNotification("Не удалось открыть форму действия");
        return;
    }

    const config = {
        approve: {
            title: "Одобрение заявки",
            label: "Комментарий менеджера",
            hint: "Можно оставить пустым, если дополнительных пояснений не нужно.",
            submitText: "Одобрить",
            value: ""
        },
        needs_revision: {
            title: "Возврат на доработку",
            label: "Что нужно исправить",
            hint: "Опиши, что нужно дополнить или переделать, чтобы сотрудник смог отправить заявку повторно.",
            submitText: "Вернуть на доработку",
            value: request.managerComment || ""
        },
        reject: {
            title: "Отклонение заявки",
            label: "Причина отклонения",
            hint: "Укажи причину, чтобы сотрудник понимал, почему заявка не принята.",
            submitText: "Отклонить",
            value: request.managerComment || ""
        }
    }[actionType];

    if (!config) {
        return;
    }

    title.textContent = config.title;
    label.textContent = config.label;
    hint.textContent = config.hint;
    submitBtn.textContent = config.submitText;
    textarea.value = config.value;
    idField.value = String(id);
    typeField.value = actionType;

    openModal("manualRequestActionModal");
    window.setTimeout(() => textarea.focus(), 0);
}

async function performManualRequestAction(actionType, id, managerComment) {
    const urlMap = {
        approve: "/MainPage?handler=ApproveManualTimeRequest",
        needs_revision: "/MainPage?handler=NeedsRevisionManualTimeRequest",
        reject: "/MainPage?handler=RejectManualTimeRequest"
    };

    const successMap = {
        approve: "Заявка одобрена",
        needs_revision: "Заявка возвращена на доработку",
        reject: "Заявка отклонена"
    };

    const res = await fetch(urlMap[actionType], {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": getRequestVerificationToken()
        },
        body: JSON.stringify({
            id: id,
            managerComment: managerComment
        })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
        showNotification(data?.error || "Не удалось обработать заявку");
        return false;
    }

    showNotification(successMap[actionType]);
    closeModal("manualRequestActionModal");
    await loadManualTimeRequests();
    return true;
}

async function submitManualRequestAction() {
    const id = Number(document.getElementById("manualRequestActionId")?.value || 0);
    const actionType = document.getElementById("manualRequestActionType")?.value || "";
    const managerComment = document.getElementById("manualRequestActionComment")?.value.trim() || "";

    if (!id || !actionType) {
        showNotification("Не удалось определить действие");
        return;
    }

    if ((actionType === "needs_revision" || actionType === "reject") && !managerComment) {
        showNotification(actionType === "reject" ? "Укажите причину отклонения" : "Укажите, что нужно исправить");
        return;
    }

    try {
        await performManualRequestAction(actionType, id, managerComment);
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function approveManualTimeRequest(id) {
    openManualRequestActionModal(id, "approve");
}

function sendManualTimeRequestToRevision(id) {
    openManualRequestActionModal(id, "needs_revision");
}

function rejectManualTimeRequest(id) {
    openManualRequestActionModal(id, "reject");
}

function renderDashboardManualTimeRequests() {
    const body = document.getElementById("dashboardManualTimeRequestsBody");
    if (!body) return;

    const items = manualTimeRequests.filter(x => Number(x.userId) === Number(currentUserId));

    if (!items.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Заявок пока нет</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = items.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canEdit = Boolean(x.canResubmit);

        return `
            <tr>
                <td>${escapeUserText(x.workDate || "-")}</td>
                <td>${escapeUserText(x.taskName || "-")}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${renderManualRequestPreview(x)}</td>
                <td>${renderManualTimeStatus(status)}</td>
                <td>
                    ${x.attachmentPath
                ? `<a href="${escapeUserText(x.attachmentPath)}" target="_blank" class="btn btn-sm btn-outline manual-file-btn" title="${escapeUserText(x.attachmentName || "Файл")}">
                                 <i class="fas fa-paperclip"></i>
                            </a>`
                : `<span style="display:inline-block; width:100%; text-align:center;">-</span>`
            }
                </td>
                <td>
                    ${canEdit
                ? `<button class="btn btn-sm btn-outline" type="button" onclick="startManualRequestEdit(${x.id})">Доработать</button>`
                : `<button class="btn btn-sm btn-outline" type="button" onclick="showManualRequestDetails(${x.id})">Подробнее</button>`}
                </td>
            </tr>
        `;
    }).join("");
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
