using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;

namespace RemoteControl1.Services
{
    public class ReportService
    {
        private readonly AppDbContext _db;

        public ReportService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<ExportDataVm> BuildExportDataAsync(
            int currentUserId,
            string currentUserRole,
            int? selectedUserId,
            string? dateFrom,
            string? dateTo,
            int? projectId)
        {
            if (currentUserId <= 0)
                return new ExportDataVm();

            var role = (currentUserRole ?? "").ToLower();
            var isAdmin = role == "admin";
            var isManager = role == "manager";

            int targetUserId = currentUserId;

            if (isAdmin)
            {
                if (selectedUserId.HasValue)
                    targetUserId = selectedUserId.Value;
            }
            else if (isManager)
            {
                if (selectedUserId.HasValue)
                {
                    var managerProjectIds = await _db.Projects
                        .Where(p => p.ManagerId == currentUserId)
                        .Select(p => p.Id)
                        .ToListAsync();

                    var allowed = await _db.Tasks.AnyAsync(t =>
                        t.UserId == selectedUserId.Value &&
                        managerProjectIds.Contains(t.ProjectId));

                    if (allowed)
                        targetUserId = selectedUserId.Value;
                }
            }

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == targetUserId);

            DateTime? from = null;
            DateTime? to = null;

            if (DateTime.TryParse(dateFrom, out var fromDate))
                from = fromDate.Date;

            if (DateTime.TryParse(dateTo, out var toDate))
                to = toDate.Date.AddDays(1).AddTicks(-1);

            from ??= DateTime.Today.AddDays(-30);
            to ??= DateTime.Today.Date.AddDays(1).AddTicks(-1);

            var query = _db.ActivityLogs
                .Include(a => a.TaskItem)
                    .ThenInclude(t => t!.Project)
                .Where(a =>
                    a.UserId == targetUserId &&
                    (a.ActivityType == "task_timer" || a.ActivityType == "manual_time"));

            if (isManager)
            {
                var managerProjectIds = await _db.Projects
                    .Where(p => p.ManagerId == currentUserId)
                    .Select(p => p.Id)
                    .ToListAsync();

                query = query.Where(a => a.ProjectId.HasValue && managerProjectIds.Contains(a.ProjectId.Value));
            }

            if (from.HasValue)
                query = query.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) >= from.Value);

            if (to.HasValue)
                query = query.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) <= to.Value);

            if (projectId.HasValue)
                query = query.Where(a => a.ProjectId == projectId.Value);

            var logs = await query
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToListAsync();

            var rows = logs.Select(a => new ExportRowVm
            {
                Date = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                Task = a.TaskItem?.Title ?? "Без задачи",
                Project = a.TaskItem?.Project?.Name ?? "Без проекта",
                Hours = a.DurationHours,
                Comment = string.IsNullOrWhiteSpace(a.Comment) ? "Без комментария" : a.Comment!,
                Status = a.TaskItem?.Status ?? "-",
                Assignee = a.TaskItem?.Assignee ?? "-",
                Deadline = a.TaskItem?.Deadline.HasValue == true
                    ? a.TaskItem.Deadline.Value.ToString("dd.MM.yyyy")
                    : "-"
            }).ToList();

            var taskIds = logs
                .Where(a => a.TaskItemId.HasValue)
                .Select(a => a.TaskItemId!.Value)
                .Distinct()
                .ToList();

            var doneTasks = await _db.Tasks
                .Where(t => taskIds.Contains(t.Id) && t.Status == "done")
                .CountAsync();

            return new ExportDataVm
            {
                UserName = user == null
                    ? ""
                    : BuildFullName(user.LastName, user.FirstName, user.MiddleName),
                TotalHours = logs.Sum(x => x.DurationHours),
                DoneTasks = doneTasks,
                Rows = rows
            };
        }

        private sealed class PerformanceMetrics
        {
            public decimal PlannedHours { get; set; }
            public decimal TrackedHours { get; set; }
            public decimal WorkDayHours { get; set; }
            public decimal IdleHours { get; set; }
            public decimal SalaryHours { get; set; }
            public decimal WorkloadDiff { get; set; }
            public decimal TimeCompletionPercent { get; set; }
            public int TaskCompletionPercent { get; set; }
            public int Efficiency { get; set; }
            public int OpenTasks { get; set; }
            public int NewTasks { get; set; }
            public int ProgressTasks { get; set; }
            public int ReviewTasks { get; set; }
            public int DoneTasks { get; set; }
            public int OverdueTasks { get; set; }
            public string ProductivityState { get; set; } = "normal";
            public int BonusPercent { get; set; }
            public string BonusReason { get; set; } = "Нет данных";
        }
        public async Task<ServiceResult<TaskService.ReportDataVm>> GetReportDataAsync(int userId, string? dateFrom, string? dateTo, int? projectId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<TaskService.ReportDataVm>.Fail("Пользователь не найден");

            DateTime? from = null;
            DateTime? to = null;

            if (DateTime.TryParse(dateFrom, out var fromDate))
                from = fromDate.Date;

            if (DateTime.TryParse(dateTo, out var toDate))
                to = toDate.Date.AddDays(1).AddTicks(-1);

            from ??= DateTime.Today.AddDays(-30);
            to ??= DateTime.Today.Date.AddDays(1).AddTicks(-1);

            var logsQuery = _db.ActivityLogs
         .Include(a => a.TaskItem)
             .ThenInclude(t => t!.Project)
         .Where(a =>
         a.UserId == userId &&
         (a.ActivityType == "task_timer" || a.ActivityType == "manual_time"));

            var workDaysQuery = _db.ActivityLogs
    .Where(a =>
        a.UserId == userId &&
        a.ActivityType == "workday" &&
        !a.IsActive);


            if (from.HasValue)
                workDaysQuery = workDaysQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) >= from.Value);

            if (to.HasValue)
                workDaysQuery = workDaysQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) <= to.Value);

            if (from.HasValue)
                logsQuery = logsQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) >= from.Value);

            if (to.HasValue)
                logsQuery = logsQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) <= to.Value);

            if (projectId.HasValue)
                logsQuery = logsQuery.Where(a => a.ProjectId == projectId.Value);

            var logs = await logsQuery
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToListAsync();

            var workDays = await workDaysQuery
    .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
    .ToListAsync();

            var tasksQuery = _db.Tasks
                .Include(t => t.Project)
                .Where(t => t.UserId == userId);

            if (projectId.HasValue)
                tasksQuery = tasksQuery.Where(t => t.ProjectId == projectId.Value);

            if (to.HasValue)
                tasksQuery = tasksQuery.Where(t => t.CreatedAtUtc <= to.Value);

            var tasks = await tasksQuery.ToListAsync();

            if (projectId.HasValue)
                workDays = new List<ActivityLog>();

            var referenceDate = to?.Date ?? DateTime.Today;
            var metrics = CalculatePerformanceMetrics(tasks, logs, workDays, referenceDate);
            var completedTasks = metrics.DoneTasks;
            var overtimeHours = Math.Round(workDays.Sum(x => x.OvertimeHours), 2);
            var overdueTasks = BuildOverdueItems(tasks, referenceDate);

            var byProjects = logs
                .GroupBy(x => x.TaskItem?.Project?.Name ?? "Без проекта")
                .Select(g => new ChartItemVm
                {
                    Label = g.Key,
                    Value = (decimal)Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderByDescending(x => x.Value)
                .ToList();

            var byDays = logs
           .GroupBy(x => (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().Date)
           .OrderBy(g => g.Key)
           .Select(g => new ChartItemVm
           {
               Label = g.Key.ToString("dd.MM"),
               Value = Math.Round(g.Sum(x => x.DurationHours), 2)
           })
           .ToList();

            var entries = logs.Select(a => new ReportEntryVm
            {
                TaskId = a.TaskItemId,
                Date = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                Task = a.TaskItem?.Title ?? "Без задачи",
                Project = a.TaskItem?.Project?.Name ?? "Без проекта",
                Hours = a.DurationHours,
                Comment = string.IsNullOrWhiteSpace(a.Comment) ? "Без комментария" : a.Comment!,
                Status = a.TaskItem?.Status ?? "-"
            }).ToList();

            var plannedHours = metrics.PlannedHours;
            var actualHours = metrics.TrackedHours;
            var efficiency = metrics.Efficiency;
            var bonusPercent = metrics.BonusPercent;
            var bonusReason = metrics.BonusReason;
            var bonusAmount = Math.Round(actualHours * user.HourlyRate * bonusPercent / 100m, 2);

            var result = new TaskService.ReportDataVm
            {
                UserName = string.Join(" ", new[] { user.LastName, user.FirstName, user.MiddleName }
                    .Where(x => !string.IsNullOrWhiteSpace(x))),
                TotalHours = actualHours,
                CompletedTasks = completedTasks,
                OvertimeHours = overtimeHours,
                PlannedHours = plannedHours,
                ActualHours = actualHours,
                Efficiency = efficiency,
                OverdueCount = overdueTasks.Count,
                BonusPercent = bonusPercent,
                BonusAmount = bonusAmount,
                BonusReason = bonusReason,
                Entries = entries,
                ByProjects = byProjects,
                ByDays = byDays,
                OverdueTasks = overdueTasks
            };

            return ServiceResult<TaskService.ReportDataVm>.Success(result);
        }
        public async Task<AdminAnalyticsVm> GetAdminAnalyticsAsync(int currentUserId, string currentUserRole)
        {
            var role = (currentUserRole ?? "").ToLower();

            List<User> users;
            List<TaskItem> allTasks;
            List<ActivityLog> allActivities;

            if (role == "admin")
            {
                users = await _db.Users
                    .OrderBy(u => u.LastName)
                    .ThenBy(u => u.FirstName)
                    .ToListAsync();

                allTasks = await _db.Tasks.ToListAsync();
                allActivities = await _db.ActivityLogs.ToListAsync();
            }
            else if (role == "manager")
            {
                var managerProjectIds = await _db.Projects
                    .Where(p => p.ManagerId == currentUserId)
                    .Select(p => p.Id)
                    .ToListAsync();

                var visibleUserIds = await _db.ProjectMembers
                    .Where(x => managerProjectIds.Contains(x.ProjectId))
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToListAsync();

                users = await _db.Users
                    .Where(u => visibleUserIds.Contains(u.Id) && u.Role != "admin")
                    .OrderBy(u => u.LastName)
                    .ThenBy(u => u.FirstName)
                    .ToListAsync();

                allTasks = await _db.Tasks
                    .Where(t => managerProjectIds.Contains(t.ProjectId))
                    .ToListAsync();

                allActivities = await _db.ActivityLogs
                    .Where(a =>
                        (a.ActivityType == "workday" && visibleUserIds.Contains(a.UserId)) ||
                        (
                            (a.ActivityType == "task_timer" || a.ActivityType == "manual_time") &&
                            a.ProjectId.HasValue &&
                            managerProjectIds.Contains(a.ProjectId.Value)
                        ))
                    .ToListAsync();
            }
            else
            {
                return new AdminAnalyticsVm();
            }

            var userItems = users
                .Select(u => UserService.BuildUserVm(u, allTasks, allActivities))
                .ToList();

            return new AdminAnalyticsVm
            {
                Users = userItems,
                TotalUsers = userItems.Count,
                ActiveUsers = userItems.Count(x => x.Status == "active"),
                ManagersCount = userItems.Count(x => (x.Role ?? "").ToLower() == "manager"),
                AverageRate = userItems.Count > 0
                    ? Math.Round(userItems.Average(x => (double)x.HourlyRate), 0)
                    : 0,
                OverloadedCount = userItems.Count(x => x.ProductivityState == "overloaded"),
                UnderloadedCount = userItems.Count(x => x.ProductivityState == "underloaded"),
                NoActivityCount = userItems.Count(x =>
                    x.TrackedHours <= 0 &&
                    (x.TasksInProgress > 0 || x.PlannedHours > 0 || x.WorkDayHours > 0))
            };
        }

        public async Task<ReportsVm> GetReportsDataAsync(
     int currentUserId,
     string currentUserRole,
     bool isAdmin,
     string? dateFrom,
     string? dateTo,
     int? projectId,
     int? employeeId)
        {
            var currentRole = (currentUserRole ?? "").ToLower();
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);

            var allUsers = await _db.Users.ToListAsync();
            var allTasks = await _db.Tasks
                .Include(t => t.Project)
                .ToListAsync();

            var allLogs = await _db.ActivityLogs
                .Include(a => a.TaskItem)
                    .ThenInclude(t => t!.Project)
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToListAsync();

            var allWorkDays = await _db.ActivityLogs
                .Where(a => a.ActivityType == "workday" && !a.IsActive)
                .ToListAsync();

            var range = BuildDateRange(dateFrom, dateTo);

            IEnumerable<TaskItem> tasksQuery = allTasks;
            IEnumerable<ActivityLog> logsQuery = allLogs;
            IEnumerable<ActivityLog> workDaysQuery = allWorkDays;

            List<int> managerProjectIds = new();
            List<int> managerUserIds = new();

            if (!isAdmin && currentRole == "employee")
            {
                tasksQuery = tasksQuery.Where(t => t.UserId == currentUserId);
                logsQuery = logsQuery.Where(a => a.UserId == currentUserId);
                workDaysQuery = workDaysQuery.Where(a => a.UserId == currentUserId);
            }
            else if (!isAdmin && currentRole == "manager")
            {
                managerProjectIds = await _db.Projects
                    .Where(p => p.ManagerId == currentUserId)
                    .Select(p => p.Id)
                    .Distinct()
                    .ToListAsync();

                managerUserIds = await _db.ProjectMembers
                    .Where(x => managerProjectIds.Contains(x.ProjectId))
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToListAsync();

                tasksQuery = tasksQuery.Where(t => managerProjectIds.Contains(t.ProjectId));

                logsQuery = logsQuery.Where(a =>
                    a.ProjectId.HasValue &&
                    managerProjectIds.Contains(a.ProjectId.Value));

                workDaysQuery = workDaysQuery.Where(a => managerUserIds.Contains(a.UserId));
            }

            if (employeeId.HasValue)
            {
                if (isAdmin)
                {
                    tasksQuery = tasksQuery.Where(t => t.UserId == employeeId.Value);
                    logsQuery = logsQuery.Where(a => a.UserId == employeeId.Value);
                    workDaysQuery = workDaysQuery.Where(a => a.UserId == employeeId.Value);
                }
                else if (currentRole == "manager")
                {
                    if (managerUserIds.Contains(employeeId.Value))
                    {
                        tasksQuery = tasksQuery.Where(t => t.UserId == employeeId.Value);
                        logsQuery = logsQuery.Where(a => a.UserId == employeeId.Value);
                        workDaysQuery = workDaysQuery.Where(a => a.UserId == employeeId.Value);
                    }
                    else
                    {
                        tasksQuery = Enumerable.Empty<TaskItem>();
                        logsQuery = Enumerable.Empty<ActivityLog>();
                        workDaysQuery = Enumerable.Empty<ActivityLog>();
                    }
                }
            }

            if (projectId.HasValue)
            {
                tasksQuery = tasksQuery.Where(t => t.ProjectId == projectId.Value);
                logsQuery = logsQuery.Where(a => a.ProjectId == projectId.Value);
            }

            tasksQuery = tasksQuery.Where(t => t.CreatedAtUtc <= range.To);

            logsQuery = logsQuery.Where(a =>
            {
                var d = a.EndedAtUtc ?? a.StartedAtUtc;
                return d >= range.From && d <= range.To;
            });

            workDaysQuery = workDaysQuery.Where(a =>
            {
                var d = a.EndedAtUtc ?? a.StartedAtUtc;
                return d >= range.From && d <= range.To;
            });

            var scopedTasks = tasksQuery.ToList();

            var scopedLogs = logsQuery
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToList();

            var scopedWorkDays = workDaysQuery
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToList();

            if (projectId.HasValue)
                scopedWorkDays = new List<ActivityLog>();

            var dayLogs = scopedLogs
                .Where(a => SameDay((a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime(), range.To.ToLocalTime()))
                .ToList();

            var weekStart = range.To.Date.AddDays(-6);

            var weekLogs = scopedLogs
                .Where(a =>
                {
                    var d = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().Date;
                    return d >= weekStart && d <= range.To.Date;
                })
                .ToList();

            var referenceDate = range.To.Date;
            var overdueItems = BuildOverdueItems(scopedTasks, referenceDate);

            var selectedUser = employeeId.HasValue
                ? allUsers.FirstOrDefault(x => x.Id == employeeId.Value)
                : currentUser;

            var dayWorkDays = scopedWorkDays
                .Where(a => SameDay((a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime(), range.To.ToLocalTime()))
                .ToList();

            var weekWorkDays = scopedWorkDays
                .Where(a =>
                {
                    var d = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().Date;
                    return d >= weekStart && d <= range.To.Date;
                })
                .ToList();

            var dailyHours = SumHours(dayLogs);
            var weeklyHours = SumHours(weekLogs);
            var monthlyHours = SumHours(scopedLogs);

            var dailyOvertime = Math.Round(dayWorkDays.Sum(x => x.OvertimeHours), 2);
            var weeklyOvertime = Math.Round(weekWorkDays.Sum(x => x.OvertimeHours), 2);
            var monthlyOvertime = Math.Round(scopedWorkDays.Sum(x => x.OvertimeHours), 2);

            var dailyCompleted = CountCompletedWorkedTasks(dayLogs, scopedTasks);
            var weeklyCompleted = CountCompletedWorkedTasks(weekLogs, scopedTasks);
            var monthlyCompleted = CountCompletedWorkedTasks(scopedLogs, scopedTasks);

            var metrics = CalculatePerformanceMetrics(scopedTasks, scopedLogs, scopedWorkDays, referenceDate);
            var plannedHours = metrics.PlannedHours;
            var actualHours = metrics.TrackedHours;
            var efficiency = metrics.Efficiency;
            var bonusPercent = metrics.BonusPercent;
            var bonusReason = metrics.BonusReason;

            var bonusAmount = CalculateBonusAmount(scopedLogs, scopedWorkDays, allUsers, selectedUser, bonusPercent);

            return new ReportsVm
            {
                Daily = new ReportPeriodVm
                {
                    TotalHours = dailyHours,
                    CompletedTasks = dailyCompleted,
                    Overtime = dailyOvertime,
                    Entries = dayLogs.Select(BuildReportEntryVm).ToList()
                },
                Weekly = new WeeklyReportVm
                {
                    TotalHours = weeklyHours,
                    CompletedTasks = weeklyCompleted,
                    Overtime = weeklyOvertime,
                    Entries = weekLogs.Select(BuildReportEntryVm).ToList(),
                    ByDays = GroupLogsByDays(weekLogs),
                    ByProjects = GroupLogsByProjects(weekLogs)
                },
                Monthly = new MonthlyReportVm
                {
                    TotalHours = monthlyHours,
                    CompletedTasks = monthlyCompleted,
                    Overtime = monthlyOvertime,
                    Entries = scopedLogs.Select(BuildReportEntryVm).ToList(),
                    ByProjects = GroupLogsByProjects(scopedLogs),
                    ByWeeks = GroupLogsByWeeks(scopedLogs, range.From)
                },
                Performance = new PerformanceReportVm
                {
                    Efficiency = efficiency,
                    OverdueCount = metrics.OverdueTasks,
                    Overtime = monthlyOvertime,
                    PlannedHours = plannedHours,
                    ActualHours = actualHours,
                    NewCount = metrics.NewTasks,
                    ProgressCount = metrics.ProgressTasks,
                    ReviewCount = metrics.ReviewTasks,
                    DoneCount = metrics.DoneTasks
                },
                Overdue = new OverdueReportVm
                {
                    Count = overdueItems.Count,
                    AverageDelay = overdueItems.Count > 0
                        ? (int)Math.Round(overdueItems.Average(x => x.DelayDays))
                        : 0,
                    Assignees = overdueItems
                        .Select(x => x.Assignee ?? "")
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Distinct()
                        .Count(),
                    Items = overdueItems
                },
                Overtime = new OvertimeReportVm
                {
                    Total = monthlyOvertime,
                    MaxDay = GetMaxOvertimeDay(scopedWorkDays),
                    DaysCount = GetOvertimeDays(scopedWorkDays).Count,
                    ByDays = GetOvertimeDays(scopedWorkDays)
                },
                Bonus = new BonusReportVm
                {
                    Percent = bonusPercent,
                    Amount = bonusAmount,
                    Reason = bonusReason
                }
            };
        }


        private static string BuildFullName(string? lastName, string? firstName, string? middleName)
        {
            return string.Join(" ", new[] { lastName, firstName, middleName }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        private static ReportEntryVm BuildReportEntryVm(ActivityLog a)
        {
            return new ReportEntryVm
            {
                TaskId = a.TaskItemId,
                Date = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                Task = a.TaskItem?.Title ?? "Без задачи",
                Project = a.TaskItem?.Project?.Name ?? "Без проекта",
                Hours = a.DurationHours,
                Comment = string.IsNullOrWhiteSpace(a.Comment) ? "Без комментария" : a.Comment!,
                Status = a.TaskItem?.Status ?? "-",
                Assignee = a.TaskItem?.Assignee ?? "-",
                Deadline = a.TaskItem?.Deadline.HasValue == true
                    ? a.TaskItem.Deadline.Value.ToString("dd.MM.yyyy")
                    : "-"
            };
        }

        private static (DateTime From, DateTime To) BuildDateRange(string? dateFrom, string? dateTo)
        {
            DateTime from;
            DateTime to;

            if (!DateTime.TryParse(dateFrom, out from))
                from = DateTime.Today.AddDays(-30);

            if (!DateTime.TryParse(dateTo, out to))
                to = DateTime.Today;

            from = from.Date;
            to = to.Date.AddDays(1).AddTicks(-1);

            return (from, to);
        }

        private static decimal SumHours(List<ActivityLog> logs)
        {
            return Math.Round(logs.Sum(x => x.DurationHours), 2);
        }

        private static decimal CalculateOvertime(List<ActivityLog> logs)
        {
            return Math.Round((decimal)GetOvertimeDays(logs).Sum(x => x.Value), 2);
        }

        private static List<ChartItemVm> GetOvertimeDays(List<ActivityLog> logs)
        {
            return logs
                .GroupBy(x => (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().Date)
                .Select(g => new ChartItemVm
                {
                    Label = g.Key.ToString("dd.MM.yyyy"),
                    Value = Math.Round(g.Sum(x => x.OvertimeHours > 0 ? x.OvertimeHours : 0m), 2)
                })
                .Where(x => x.Value > 0)
                .OrderBy(x => x.Label)
                .ToList();
        }

        private static decimal GetMaxOvertimeDay(List<ActivityLog> logs)
        {
            var days = GetOvertimeDays(logs);
            return days.Count > 0 ? (decimal)days.Max(x => x.Value) : 0m;
        }

        private static string NormalizeTaskStatusKey(string? value)
        {
            return (value ?? "").Trim().ToLowerInvariant();
        }

        private static bool IsTaskDone(string? value)
        {
            return NormalizeTaskStatusKey(value) == "done";
        }

        private static bool IsOpenTaskStatus(string? value)
        {
            return NormalizeTaskStatusKey(value) switch
            {
                "new" => true,
                "progress" => true,
                "review" => true,
                _ => false
            };
        }

        private static decimal CalculateBonusAmount(
            List<ActivityLog> taskLogs,
            List<ActivityLog> workDayLogs,
            List<User> users,
            User? selectedUser,
            int bonusPercent)
        {
            if (bonusPercent <= 0)
                return 0m;

            var ratesByUserId = users.ToDictionary(x => x.Id, x => x.HourlyRate);
            var taskHoursByUser = taskLogs
                .GroupBy(x => x.UserId)
                .ToDictionary(g => g.Key, g => Math.Round(g.Sum(x => x.DurationHours), 2));
            var workHoursByUser = workDayLogs
                .GroupBy(x => x.UserId)
                .ToDictionary(g => g.Key, g => Math.Round(g.Sum(x => x.TrackedHours), 2));
            var userIds = taskHoursByUser.Keys
                .Concat(workHoursByUser.Keys)
                .Distinct()
                .ToList();

            if (userIds.Count == 0 && selectedUser != null)
                userIds.Add(selectedUser.Id);

            var amount = 0m;

            foreach (var userId in userIds)
            {
                var taskHours = taskHoursByUser.TryGetValue(userId, out var logged) ? logged : 0m;
                var workHours = workHoursByUser.TryGetValue(userId, out var worked) ? worked : 0m;
                var hours = Math.Max(taskHours, workHours);
                var rate = ratesByUserId.TryGetValue(userId, out var userRate) ? userRate : selectedUser?.HourlyRate ?? 0m;

                amount += hours * rate * bonusPercent / 100m;
            }

            return Math.Round(amount, 2);
        }

        private static string GetProductivityState(
            decimal plannedHours,
            decimal timeCompletionPercent,
            int openTasks,
            decimal trackedHours)
        {
            if (openTasks <= 0 && trackedHours <= 0m && plannedHours <= 0m)
                return "no_data";

            if (openTasks >= 6 || (plannedHours > 0m && timeCompletionPercent > 120m))
                return "overloaded";

            if (plannedHours > 0m && timeCompletionPercent < 70m)
                return "underloaded";

            return "normal";
        }

        private static (int Percent, string Reason) CalculateBonusRecommendation(
            decimal plannedHours,
            decimal trackedHours,
            int taskCompletionPercent,
            int overdueTasks)
        {
            if (plannedHours <= 0m)
                return (0, "Нет плана по задачам");

            if (trackedHours <= 0m)
                return (0, "Нет фактически учтённого времени");

            var timeCompletionPercent = (trackedHours / plannedHours) * 100m;

            if (overdueTasks > 0)
            {
                if (timeCompletionPercent >= 100m && taskCompletionPercent >= 70)
                    return (5, "Есть просрочки: бонус ограничен");

                return (0, "Есть просроченные задачи");
            }

            if (timeCompletionPercent >= 110m && taskCompletionPercent >= 70)
                return (15, "План перевыполнен без просрочек");

            if (timeCompletionPercent >= 100m && taskCompletionPercent >= 50)
                return (10, "План выполнен без просрочек");

            if (timeCompletionPercent >= 80m)
                return (5, "План близок к выполнению");

            return (0, "План по задачам не выполнен");
        }

        private static PerformanceMetrics CalculatePerformanceMetrics(
            IEnumerable<TaskItem> taskSource,
            IEnumerable<ActivityLog> taskLogSource,
            IEnumerable<ActivityLog> workDayLogSource,
            DateTime referenceDate)
        {
            var tasks = taskSource.ToList();
            var taskLogs = taskLogSource
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToList();
            var workDayLogs = workDayLogSource
                .Where(a => a.ActivityType == "workday" && !a.IsActive)
                .ToList();

            var plannedHours = Math.Round(tasks.Sum(t => t.PlannedTimeHours), 2);
            var trackedFromLogs = Math.Round(taskLogs.Sum(a => a.DurationHours), 2);
            var trackedFromWorkDays = Math.Round(workDayLogs.Sum(a => a.TrackedHours), 2);
            var trackedHours = Math.Max(trackedFromLogs, trackedFromWorkDays);

            var workDayHours = Math.Round(workDayLogs.Sum(a => a.DurationHours), 2);
            var idleStored = Math.Round(workDayLogs.Sum(a => a.IdleHours), 2);
            var idleHours = workDayHours > 0m
                ? Math.Round(Math.Max(0m, workDayHours - trackedHours), 2)
                : idleStored;

            var newTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "new");
            var progressTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "progress");
            var reviewTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "review");
            var doneTasks = tasks.Count(t => IsTaskDone(t.Status));
            var openTasks = tasks.Count(t => IsOpenTaskStatus(t.Status));
            var totalTasks = tasks.Count;

            var overdueTasks = tasks.Count(t =>
                t.Deadline.HasValue &&
                t.Deadline.Value.Date < referenceDate.Date &&
                !IsTaskDone(t.Status));

            var timeCompletionPercent = plannedHours > 0m
                ? Math.Round((trackedHours / plannedHours) * 100m, 0)
                : 0m;

            var taskCompletionPercent = totalTasks > 0
                ? (int)Math.Round((double)doneTasks / totalTasks * 100d)
                : 0;

            var hourRateForEfficiency = plannedHours > 0m
                ? (int)Math.Min(100m, timeCompletionPercent)
                : 0;

            var efficiency = totalTasks > 0 && plannedHours > 0m
                ? (int)Math.Round((taskCompletionPercent + hourRateForEfficiency) / 2d)
                : plannedHours > 0m
                    ? hourRateForEfficiency
                    : taskCompletionPercent;

            var productivityState = GetProductivityState(
                plannedHours,
                timeCompletionPercent,
                openTasks,
                trackedHours);

            var bonus = CalculateBonusRecommendation(
                plannedHours,
                trackedHours,
                taskCompletionPercent,
                overdueTasks);

            return new PerformanceMetrics
            {
                PlannedHours = plannedHours,
                TrackedHours = trackedHours,
                WorkDayHours = workDayHours,
                IdleHours = idleHours,
                SalaryHours = trackedHours,
                WorkloadDiff = Math.Round(trackedHours - plannedHours, 2),
                TimeCompletionPercent = timeCompletionPercent,
                TaskCompletionPercent = taskCompletionPercent,
                Efficiency = efficiency,
                OpenTasks = openTasks,
                NewTasks = newTasks,
                ProgressTasks = progressTasks,
                ReviewTasks = reviewTasks,
                DoneTasks = doneTasks,
                OverdueTasks = overdueTasks,
                ProductivityState = productivityState,
                BonusPercent = bonus.Percent,
                BonusReason = bonus.Reason
            };
        }

        private static int CountCompletedWorkedTasks(List<ActivityLog> logs, List<TaskItem> tasks)
        {
            var workedTaskIds = logs
                .Where(x => x.TaskItemId.HasValue)
                .Select(x => x.TaskItemId!.Value)
                .Distinct()
                .ToHashSet();

            return tasks.Count(t =>
                IsTaskDone(t.Status) &&
                workedTaskIds.Contains(t.Id));
        }

        private static List<ChartItemVm> GroupLogsByDays(List<ActivityLog> logs)
        {
            var dayNames = new Dictionary<DayOfWeek, string>
            {
                [DayOfWeek.Monday] = "Пн",
                [DayOfWeek.Tuesday] = "Вт",
                [DayOfWeek.Wednesday] = "Ср",
                [DayOfWeek.Thursday] = "Чт",
                [DayOfWeek.Friday] = "Пт",
                [DayOfWeek.Saturday] = "Сб",
                [DayOfWeek.Sunday] = "Вс"
            };

            return logs
                .GroupBy(x => (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().DayOfWeek)
                .Select(g => new ChartItemVm
                {
                    Label = dayNames[g.Key],
                    Value = (decimal)Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderBy(x => DayOrder(x.Label))
                .ToList();
        }

        private static int DayOrder(string day)
        {
            return day switch
            {
                "Пн" => 1,
                "Вт" => 2,
                "Ср" => 3,
                "Чт" => 4,
                "Пт" => 5,
                "Сб" => 6,
                "Вс" => 7,
                _ => 99
            };
        }

        private static List<ChartItemVm> GroupLogsByProjects(List<ActivityLog> logs)
        {
            return logs
                .GroupBy(x => x.TaskItem?.Project?.Name ?? "Без проекта")
                .Select(g => new ChartItemVm
                {
                    Label = g.Key,
                    Value = (decimal)Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderByDescending(x => x.Value)
                .ToList();
        }

        private static List<ChartItemVm> GroupLogsByWeeks(List<ActivityLog> logs, DateTime rangeFrom)
        {
            var start = rangeFrom.Date;

            return logs
                .GroupBy(x =>
                {
                    var d = (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().Date;
                    var diffDays = (d - start).Days;
                    var weekIndex = Math.Max(0, diffDays / 7) + 1;
                    return weekIndex;
                })
                .Select(g => new ChartItemVm
                {
                    Label = $"Неделя {g.Key}",
                    Value = (decimal)Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderBy(x => x.Label)
                .ToList();
        }

        private static List<OverdueTaskVm> BuildOverdueItems(List<TaskItem> tasks, DateTime referenceDate)
        {
            var targetDate = referenceDate.Date;

            return tasks
                .Where(t => t.Deadline.HasValue && !IsTaskDone(t.Status))
                .Select(t =>
                {
                    var delay = (targetDate - t.Deadline!.Value.Date).Days;

                    return new OverdueTaskVm
                    {
                        Name = t.Title ?? "",
                        Project = t.Project?.Name ?? "",
                        Assignee = t.Assignee ?? "",
                        Deadline = t.Deadline.HasValue ? t.Deadline.Value.ToString("dd.MM.yyyy") : "",
                        DelayDays = delay > 0 ? delay : 0
                    };
                })
                .Where(x => x.DelayDays > 0)
                .OrderByDescending(x => x.DelayDays)
                .ToList();
        }

        private static bool SameDay(DateTime a, DateTime b)
        {
            return a.Date == b.Date;
        }


    }

    public class ExportDataVm
    {
        public string UserName { get; set; } = "";
        public decimal TotalHours { get; set; }
        public int DoneTasks { get; set; }
        public List<ExportRowVm> Rows { get; set; } = new();
    }

    public class ExportRowVm
    {
        public string Date { get; set; } = "";
        public string Task { get; set; } = "";
        public string Project { get; set; } = "";
        public decimal Hours { get; set; }
        public string Comment { get; set; } = "";
        public string Status { get; set; } = "";
        public string Assignee { get; set; } = "";
        public string Deadline { get; set; } = "";
    }
}
