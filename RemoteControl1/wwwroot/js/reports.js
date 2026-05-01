// Файл: RemoteControl1/wwwroot/js/reports.js

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

function formatReportDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function ensureDefaultReportRange() {
    const fromInput = document.getElementById("reportDateFrom");
    const toInput = document.getElementById("reportDateTo");

    if (!fromInput || !toInput) return;

    if (fromInput.value && toInput.value) return;

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);

    if (!fromInput.value) {
        fromInput.value = formatReportDateInputValue(from);
    }

    if (!toInput.value) {
        toInput.value = formatReportDateInputValue(today);
    }
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
    const cards = document.querySelectorAll("#reportsContent .report-card");

    cards.forEach(card => {
        card.classList.add("hidden");
    });

    const target = document.getElementById(reportId + "Report");
    if (target) {
        target.classList.remove("hidden");
    }

    document.querySelectorAll(".reports-menu-link").forEach(link => {
        link.classList.remove("active");
    });

    if (el) {
        el.classList.add("active");
    } else {
        document.querySelectorAll(".reports-menu-link").forEach(link => {
            const clickText = link.getAttribute("onclick") || "";
            if (clickText.includes(`showReport('${reportId}'`)) {
                link.classList.add("active");
            }
        });
    }

    return false;
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
    } catch (e) {
        console.error(e);

        const box = document.getElementById("reportsContent");
        if (box) {
            box.innerHTML = `<div class="card"><div style="color:var(--danger);">Не удалось загрузить отчёты</div></div>`;
        }

        if (typeof showNotification === "function") {
            showNotification("Не удалось загрузить отчет");
        }
    }
}

function filterReports() {
    updateReports();
}

function initReportsPage() {
    ensureDefaultReportRange();
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
                    <div class="stat-icon"><i class="fas fa-list-check"></i></div>
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
                            <th>Дата</th>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Часы</th>
                            <th>Комментарий</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.daily.entries || []).length
            ? data.daily.entries.map(item => `
                                <tr>
                                    <td>${item.date || ""}</td>
                                    <td>${item.task || ""}</td>
                                    <td>${item.project || ""}</td>
                                    <td>${formatHoursValue(item.hours)}</td>
                                    <td>${item.comment || "—"}</td>
                                    <td>${item.status || "—"}</td>
                                </tr>
                            `).join("")
            : `
                                <tr>
                                    <td colspan="6" style="text-align:center; color:var(--gray);">Нет данных</td>
                                </tr>
                            `
        }
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
                        <div class="stat-label">Часов за неделю</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-circle-check"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.weekly.completedTasks}</div>
                        <div class="stat-label">Завершено задач</div>
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
                    <div class="chart-title">По дням недели</div>
                    <div class="bar-chart">
                        ${(data.weekly.byDays || []).length
            ? data.weekly.byDays.map(item => `
                                <div class="bar-item">
                                    <div class="bar-label">${item.label}</div>
                                    <div class="bar-progress">
                                        <div class="bar-fill" style="width:${Math.max(4, Number(item.value || 0) * 10)}%"></div>
                                    </div>
                                    <div class="bar-value">${formatHoursValue(item.value)}</div>
                                </div>
                            `).join("")
            : `<div style="color:var(--gray);">Нет данных</div>`
        }
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">По проектам</div>
                    <div class="bar-chart">
                        ${(data.weekly.byProjects || []).length
            ? data.weekly.byProjects.map(item => `
                                <div class="bar-item">
                                    <div class="bar-label">${item.label}</div>
                                    <div class="bar-progress">
                                        <div class="bar-fill" style="width:${Math.max(4, Number(item.value || 0) * 10)}%"></div>
                                    </div>
                                    <div class="bar-value">${formatHoursValue(item.value)}</div>
                                </div>
                            `).join("")
            : `<div style="color:var(--gray);">Нет данных</div>`
        }
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
                        <div class="stat-label">Часов за месяц</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-circle-check"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.monthly.completedTasks}</div>
                        <div class="stat-label">Завершено задач</div>
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
                    <div class="chart-title">По проектам</div>
                    <div class="bar-chart">
                        ${(data.monthly.byProjects || []).length
            ? data.monthly.byProjects.map(item => `
                                <div class="bar-item">
                                    <div class="bar-label">${item.label}</div>
                                    <div class="bar-progress">
                                        <div class="bar-fill" style="width:${Math.max(4, Number(item.value || 0) * 10)}%"></div>
                                    </div>
                                    <div class="bar-value">${formatHoursValue(item.value)}</div>
                                </div>
                            `).join("")
            : `<div style="color:var(--gray);">Нет данных</div>`
        }
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">По неделям</div>
                    <div class="bar-chart">
                        ${(data.monthly.byWeeks || []).length
            ? data.monthly.byWeeks.map(item => `
                                <div class="bar-item">
                                    <div class="bar-label">${item.label}</div>
                                    <div class="bar-progress">
                                        <div class="bar-fill" style="width:${Math.max(4, Number(item.value || 0) * 10)}%"></div>
                                    </div>
                                    <div class="bar-value">${formatHoursValue(item.value)}</div>
                                </div>
                            `).join("")
            : `<div style="color:var(--gray);">Нет данных</div>`
        }
                    </div>
                </div>
            </div>
        </div>

        <div id="performanceReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Продуктивность</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-bolt"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.efficiency}%</div>
                        <div class="stat-label">Эффективность</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.performance.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-triangle-exclamation"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.overdueCount}</div>
                        <div class="stat-label">Просроченных задач</div>
                    </div>
                </div>
            </div>
        </div>

        <div id="overdueReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Просроченные задачи</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.count}</div>
                        <div class="stat-label">Просроченных задач</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-times"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.averageDelay}</div>
                        <div class="stat-label">Средняя задержка (дней)</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-group"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.assignees}</div>
                        <div class="stat-label">Сотрудников с просрочками</div>
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
                            <th>Дедлайн</th>
                            <th>Просрочка</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.overdue.items || []).length
            ? data.overdue.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.project}</td>
                                    <td>${item.assignee}</td>
                                    <td>${item.deadline}</td>
                                    <td>${item.delayDays} дн.</td>
                                </tr>
                            `).join("")
            : `
                                <tr>
                                    <td colspan="5" style="text-align:center; color:var(--gray);">Нет данных</td>
                                </tr>
                            `
        }
                    </tbody>
                </table>
            </div>
        </div>

        <div id="overtimeReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Переработки</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.total)}</div>
                        <div class="stat-label">Всего переработки</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.maxDay)}</div>
                        <div class="stat-label">Максимум за день</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overtime.daysCount}</div>
                        <div class="stat-label">Дней с переработкой</div>
                    </div>
                </div>
            </div>
        </div>

        <div id="bonusReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Система бонусов</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-percent"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.percent}%</div>
                        <div class="stat-label">Процент бонуса</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatMoneyValue(data.bonus.amount)}</div>
                        <div class="stat-label">Сумма бонуса</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-gift"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.reason || "—"}</div>
                        <div class="stat-label">Основание</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    showReport(activeId);
}

function formatHoursValue(value) {
    return `${Number(value || 0).toFixed(2)} ч`;
}

function formatMoneyValue(value) {
    return `${Number(value || 0).toFixed(2)} BYN`;
}
