
//reports.js
function getExportQuery() {
    const dateFrom = document.getElementById("reportDateFrom")?.value || "";
    const dateTo = document.getElementById("reportDateTo")?.value || "";
    const projectId = document.getElementById("reportProjectFilter")?.value || "all";
    const employeeId = document.getElementById("employeeFilter")?.value || "all";

    const params = new URLSearchParams();

    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (projectId !== "all") params.append("projectId", projectId);
    if (employeeId !== "all") params.append("userId", employeeId);

    return params.toString();
}

function exportReport(type) {
    const q = getExportQuery();
    const urlBase = `/MainPage?${q ? q + "&" : ""}`;

    if (type === "csv") {
        window.location.href = urlBase + "handler=ExportCsv";
        return;
    }

    if (type === "excel") {
        window.location.href = urlBase + "handler=ExportExcel";
        return;
    }

    if (type === "word") {
        window.location.href = urlBase + "handler=ExportWord";
        return;
    }

    if (type === "pdf") {
        window.location.href = urlBase + "handler=ExportPdf";
        return;
    }

    if (type === "print") {
        window.print();
    }
}

function exportReportsCsv() {
    exportReport("csv");
}

function fillReportFilters() {
    const employeeSelect = document.getElementById("employeeFilter");
    const projectSelect = document.getElementById("reportProjectFilter");

    if (employeeSelect) {
        const currentValue = employeeSelect.value || "all";

        employeeSelect.innerHTML =
            `<option value="all">Все сотрудники</option>` +
            users.map(u => `<option value="${u.id}">${u.fullName}</option>`).join("");

        if ([...employeeSelect.options].some(x => x.value === currentValue)) {
            employeeSelect.value = currentValue;
        }
    }

    if (projectSelect) {
        const currentValue = projectSelect.value || "all";

        projectSelect.innerHTML =
            `<option value="all">Все проекты</option>` +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

        if ([...projectSelect.options].some(x => x.value === currentValue)) {
            projectSelect.value = currentValue;
        }
    }
}

function getActiveReportId() {
    const activeLink = document.querySelector(".reports-menu-link.active");
    if (!activeLink) return "daily";

    const clickText = activeLink.getAttribute("onclick") || "";

    if (clickText.includes("showReport('daily'")) return "daily";
    if (clickText.includes("showReport('weekly'")) return "weekly";
    if (clickText.includes("showReport('monthly'")) return "monthly";
    if (clickText.includes("showReport('performance'")) return "performance";
    if (clickText.includes("showReport('overdue'")) return "overdue";
    if (clickText.includes("showReport('overtime'")) return "overtime";
    if (clickText.includes("showReport('bonus'")) return "bonus";

    return "daily";
}

function showReport(reportId, el) {
    document.querySelectorAll(".report-card").forEach(card => card.classList.add("hidden"));

    const target = document.getElementById(reportId + "Report");
    if (target) {
        target.classList.remove("hidden");
    }

    document.querySelectorAll(".reports-menu-link").forEach(link => link.classList.remove("active"));

    if (el) {
        el.classList.add("active");
    } else {
        const first = document.querySelector(".reports-menu-link");
        if (first) {
            first.classList.add("active");
        }
    }
}

async function loadReportsFromServer() {
    const dateFrom = document.getElementById("reportDateFrom")?.value || "";
    const dateTo = document.getElementById("reportDateTo")?.value || "";
    const projectId = document.getElementById("reportProjectFilter")?.value || "all";
    const employeeId = document.getElementById("employeeFilter")?.value || "all";

    const params = new URLSearchParams();

    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (projectId !== "all") params.append("projectId", projectId);
    if (employeeId !== "all") params.append("employeeId", employeeId);

    const url = `/MainPage?handler=ReportsData${params.toString() ? "&" + params.toString() : ""}`.replace("?&", "?");

    const res = await fetch(url, {
        headers: {
            "RequestVerificationToken": getRequestVerificationToken()
        }
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Не удалось загрузить отчёты");
    }

    return data.data;
}

async function updateReports() {
    try {
        const data = await loadReportsFromServer();
        renderReports(data);
        showNotification("Отчет обновлен");
    } catch (e) {
        console.error(e);

        const box = document.getElementById("reportsContent");
        if (box) {
            box.innerHTML = `<div class="card"><div style="color:var(--danger);">Не удалось загрузить отчёты</div></div>`;
        }

        showNotification("Не удалось загрузить отчет");
    }
}

function filterReports() {
    updateReports();
}

function initReportsPage() {
    fillReportFilters();
    updateReports();
}

function renderReports(data) {
    const box = document.getElementById("reportsContent");
    if (!box) return;

    const activeId = getActiveReportId();

    box.innerHTML = `
        <div id="dailyReport" class="report-card">
            <h3 style="margin-bottom:20px;">Ежедневный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.daily.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.daily.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.daily.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Время</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderEntryRows(data.daily.entries || [])}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="weeklyReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Недельный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.weekly.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.weekly.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.weekly.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">Активность по дням</div>
                    <div class="bar-chart">
                        ${renderBars(data.weekly.byDays || [])}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Распределение по проектам</div>
                    <div class="bar-chart">
                        ${renderBars(data.weekly.byProjects || [])}
                    </div>
                </div>
            </div>
        </div>

        <div id="monthlyReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Месячный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.monthly.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.monthly.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.monthly.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">Часы по проектам</div>
                    <div class="bar-chart">
                        ${renderBars(data.monthly.byProjects || [])}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Часы по неделям</div>
                    <div class="bar-chart">
                        ${renderBars(data.monthly.byWeeks || [])}
                    </div>
                </div>
            </div>
        </div>

        <div id="performanceReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Анализ продуктивности</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.efficiency}%</div>
                        <div class="stat-label">Общая эффективность</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.overdueCount}</div>
                        <div class="stat-label">Просроченных задач</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.performance.overtime)}</div>
                        <div class="stat-label">Часов переработки</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">План / факт по часам</div>
                    <div class="bar-chart">
                        ${renderBars([
        { label: "План", value: data.performance.plannedHours },
        { label: "Факт", value: data.performance.actualHours }
    ])}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Задачи по статусам</div>
                    <div class="bar-chart">
                        ${renderBars([
        { label: "Новые", value: data.performance.newCount },
        { label: "В работе", value: data.performance.progressCount },
        { label: "На проверке", value: data.performance.reviewCount },
        { label: "Завершены", value: data.performance.doneCount }
    ])}
                    </div>
                </div>
            </div>
        </div>

        <div id="overdueReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Просроченные задачи</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.count}</div>
                        <div class="stat-label">Всего просрочено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.averageDelay}</div>
                        <div class="stat-label">Средняя просрочка, дней</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.assignees}</div>
                        <div class="stat-label">Сотрудников с просрочкой</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Исполнитель</th>
                            <th>Срок</th>
                            <th>Просрочка</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderOverdueRows(data.overdue.items || [])}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="overtimeReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Переработки</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.total)}</div>
                        <div class="stat-label">Всего переработки</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.maxDay)}</div>
                        <div class="stat-label">Максимум за день</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-list"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overtime.daysCount}</div>
                        <div class="stat-label">Дней с переработкой</div>
                    </div>
                </div>
            </div>

            <div class="chart-box">
                <div class="chart-title">Переработка по дням</div>
                <div class="bar-chart">
                    ${renderBars(data.overtime.byDays || [])}
                </div>
            </div>
        </div>

        <div id="bonusReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Система бонусов</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-gift"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.percent}%</div>
                        <div class="stat-label">Рекомендованный бонус</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-ruble-sign"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatMoney(data.bonus.amount)}</div>
                        <div class="stat-label">Сумма бонуса</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.reason}</div>
                        <div class="stat-label">Основание</div>
                    </div>
                </div>
            </div>

            <div class="chart-box">
                <div class="chart-title">Основа расчета</div>
                <div class="bar-chart">
                    ${renderBars([
        { label: "Эффективность", value: data.performance.efficiency },
        { label: "План часов", value: data.performance.plannedHours },
        { label: "Факт часов", value: data.performance.actualHours },
        { label: "Завершено задач", value: data.monthly.completedTasks }
    ])}
                </div>
            </div>
        </div>
    `;

    showReport(activeId);
}

function renderEntryRows(items) {
    if (!items.length) {
        return `<tr><td colspan="4" style="text-align:center; color:var(--gray);">Нет данных за выбранный период</td></tr>`;
    }

    return items.map(x => `
        <tr>
            <td>${escapeHtml(x.task)}</td>
            <td>${escapeHtml(x.project)}</td>
            <td>${formatHours(x.hours)}</td>
            <td><span class="badge ${getStatusClass(x.status)}">${getStatusText(x.status)}</span></td>
        </tr>
    `).join("");
}

function renderOverdueRows(items) {
    if (!items.length) {
        return `<tr><td colspan="5" style="text-align:center; color:var(--gray);">Просроченных задач нет</td></tr>`;
    }

    return items.map(x => `
        <tr>
            <td>${escapeHtml(x.name)}</td>
            <td>${escapeHtml(x.project)}</td>
            <td>${escapeHtml(x.assignee)}</td>
            <td>${escapeHtml(x.deadline)}</td>
            <td>${x.delayDays} дн.</td>
        </tr>
    `).join("");
}

function renderBars(items) {
    if (!items.length) {
        return `<div style="color:var(--gray);">Нет данных</div>`;
    }

    const max = Math.max(...items.map(x => Number(x.value || 0)), 1);

    return items.map(item => {
        const width = Math.max(4, Math.round((Number(item.value || 0) / max) * 100));

        return `
            <div class="bar-item">
                <div class="bar-label">${escapeHtml(item.label)}</div>
                <div class="bar-progress">
                    <div class="bar-fill" style="width:${width}%;"></div>
                </div>
                <div class="bar-value">${formatBarValue(item.value)}</div>
            </div>
        `;
    }).join("");
}

function formatBarValue(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return formatHoursValue(value) + " ч";
}

function formatHours(value) {
    return `${formatHoursValue(value)} ч`;
}

function formatHoursValue(value) {
    return Number(value || 0).toFixed(1).replace(".0", "");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("ru-RU");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


