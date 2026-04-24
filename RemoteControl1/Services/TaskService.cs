//using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Globalization;
using System.Text.Json;

namespace RemoteControl1.Services
{
    public class TaskService
    {
        private readonly AppDbContext _db;
        private const string ManualRequestMetaPrefix = "__RCMT__";


        public TaskService(AppDbContext db)
        {
            _db = db;
        }

        private sealed class ManualTimeRequestMeta
        {
            public string? WorkDate { get; set; }
            public string? Reason { get; set; }
            public string? Comment { get; set; }
        }

        private sealed class ManualTimeRequestData
        {
            public DateTime? WorkDate { get; set; }
            public string? WorkDateValue { get; set; }
            public string Reason { get; set; } = "";
            public string Comment { get; set; } = "";
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

        public async Task<PageDataResult> GetPageDataAsync(int userId)
        {
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (currentUser == null)
                return new PageDataResult();

            var role = (currentUser.Role ?? "").ToLower();
            var isAdmin = role == "admin";
            var isManager = role == "manager";

            var allUsers = await _db.Users
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();

            List<Project> projects;
            List<int> projectIds;
            List<TaskItem> tasks;
            List<User> visibleUsers;

            if (isAdmin)
            {
                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                visibleUsers = allUsers;
            }
            else if (isManager)
            {
                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .Where(p => p.ManagerId == userId)
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .Where(t => projectIds.Contains(t.ProjectId))
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                var visibleUserIds = await _db.ProjectMembers
    .Where(x => projectIds.Contains(x.ProjectId))
    .Select(x => x.UserId)
    .Distinct()
    .ToListAsync();

                visibleUsers = allUsers
                    .Where(u =>
                        visibleUserIds.Contains(u.Id) &&
                        u.IsActive &&
                        u.Role != "admin")
                    .ToList();
            }
            else
            {
                var memberProjectIds = await _db.ProjectMembers
                    .Where(x => x.UserId == userId)
                    .Select(x => x.ProjectId)
                    .Distinct()
                    .ToListAsync();

                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .Where(p => memberProjectIds.Contains(p.Id))
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                visibleUsers = new List<User>();
            }

            var activities = await _db.ActivityLogs
    .Include(a => a.TaskItem)
    .Where(a =>
        (a.ActivityType == "task_timer" || a.ActivityType == "manual_time") &&
        (
            isAdmin ||
            (isManager && a.ProjectId.HasValue && projectIds.Contains(a.ProjectId.Value)) ||
            (!isAdmin && !isManager && a.UserId == userId)
        ))
    .OrderByDescending(a => a.Id)
    .Take(20)
    .ToListAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            var workDays = await _db.ActivityLogs
                .Where(a => a.UserId == userId && a.ActivityType == "workday" && !a.IsActive)
                .OrderByDescending(a => a.StartedAtUtc)
                .Take(20)
                .ToListAsync();


            var projectVms = new List<ProjectVm>();

            foreach (var project in projects)
            {
                var vm = await BuildProjectVm(project);
                projectVms.Add(vm);
            }

            return new PageDataResult
            {
                Tasks = tasks.Select(MapTask).ToList(),
                Projects = projectVms,
                Activity = activities.Select(BuildActivityVm).ToList(),
                Users = visibleUsers.Select(u => BuildUserVm(u, allTasks, allActivities)).ToList(),
                WorkDays = workDays.Select(x => new WorkDayVm
                {
                    Date = x.StartedAtUtc.ToLocalTime().ToString("dd.MM.yyyy"),
                    Start = x.StartedAtUtc.ToLocalTime().ToString("HH:mm"),
                    End = x.EndedAtUtc.HasValue ? x.EndedAtUtc.Value.ToLocalTime().ToString("HH:mm") : "-",
                    Hours = Math.Round(x.DurationHours, 2)
                }).ToList()
            };
        }

        public async Task<ServiceResult<ReportDataVm>> GetReportDataAsync(int userId, string? dateFrom, string? dateTo, int? projectId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<ReportDataVm>.Fail("Пользователь не найден");

            DateTime? from = null;
            DateTime? to = null;

            if (DateTime.TryParse(dateFrom, out var fromDate))
                from = fromDate.Date;

            if (DateTime.TryParse(dateTo, out var toDate))
                to = toDate.Date.AddDays(1).AddTicks(-1);

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

            var result = new ReportDataVm
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

            return ServiceResult<ReportDataVm>.Success(result);
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
                .Select(u => BuildUserVm(u, allTasks, allActivities))
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

            var rate = selectedUser?.HourlyRate ?? 0;
            var bonusAmount = Math.Round(actualHours * rate * bonusPercent / 100m, 2);

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

        public async Task<ServiceResult<TaskVm>> AddTaskAsync(int userId, AddTaskDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return ServiceResult<TaskVm>.Fail("Введите название задачи");

            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (currentUser == null)
                return ServiceResult<TaskVm>.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();

            if (role == "employee")
                return ServiceResult<TaskVm>.Fail("Нет прав");

            var project = await _db.Projects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId);

            if (project == null)
                return ServiceResult<TaskVm>.Fail("Проект не найден");

            if (role == "manager" && project.ManagerId != userId)
                return ServiceResult<TaskVm>.Fail("Нет прав на этот проект");

            var performerId = dto.UserId > 0 ? dto.UserId : userId;

            var performer = await _db.Users.FirstOrDefaultAsync(u => u.Id == performerId);
            if (performer == null)
                return ServiceResult<TaskVm>.Fail("Исполнитель не найден");

            var isMember = await _db.ProjectMembers.AnyAsync(x =>
                x.ProjectId == dto.ProjectId &&
                x.UserId == performerId);

            if (!isMember)
                return ServiceResult<TaskVm>.Fail("Сотрудник не состоит в выбранном проекте");

            var stageName = dto.StageName?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(stageName))
                return ServiceResult<TaskVm>.Fail("Выберите этап проекта");

            var allowedStageNames = await GetAllowedProjectStageNamesAsync(project);
            if (!StageBelongsToProject(stageName, allowedStageNames))
                return ServiceResult<TaskVm>.Fail("Этап не относится к выбранному проекту");

            var task = new TaskItem
            {
                Title = dto.Name.Trim(),
                Description = dto.Description?.Trim() ?? "",
                ProjectId = dto.ProjectId,
                UserId = performerId,
                Assignee = BuildFullName(performer.LastName, performer.FirstName, performer.MiddleName),
                Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "medium" : dto.Priority,
                Status = NormalizeTaskStatus(dto.Status, "new"),
                PlannedTimeHours = dto.PlannedTime,
                Deadline = dto.Deadline,
                StageName = stageName
            };

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();
            await _db.Entry(task).Reference(t => t.Project).LoadAsync();
            await _db.Entry(task).Reference(t => t.User).LoadAsync();

            return ServiceResult<TaskVm>.Success(MapTask(task));
        }

        public async Task<ServiceResult<TaskVm>> UpdateTaskAsync(int currentUserId, UpdateTaskDto dto)
        {
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);
            if (currentUser == null)
                return ServiceResult<TaskVm>.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();

            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == dto.Id);

            if (task == null)
                return ServiceResult<TaskVm>.Fail("Задача не найдена");

            if (role == "employee")
            {
                if (task.UserId != currentUserId)
                    return ServiceResult<TaskVm>.Fail("Нет прав");

                task.Status = NormalizeTaskStatus(dto.Status, task.Status);

                await _db.SaveChangesAsync();
                await _db.Entry(task).Reference(t => t.Project).LoadAsync();
                await _db.Entry(task).Reference(t => t.User).LoadAsync();

                return ServiceResult<TaskVm>.Success(MapTask(task));
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
                return ServiceResult<TaskVm>.Fail("Введите название задачи");

            var project = await _db.Projects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId);

            if (project == null)
                return ServiceResult<TaskVm>.Fail("Проект не найден");

            if (role == "manager" && project.ManagerId != currentUserId)
                return ServiceResult<TaskVm>.Fail("Нет прав на этот проект");

            var performerId = dto.UserId > 0 ? dto.UserId : task.UserId;

            var performer = await _db.Users.FirstOrDefaultAsync(u => u.Id == performerId);
            if (performer == null)
                return ServiceResult<TaskVm>.Fail("Исполнитель не найден");

            var isMember = await _db.ProjectMembers.AnyAsync(x =>
                x.ProjectId == dto.ProjectId &&
                x.UserId == performerId);

            if (!isMember)
                return ServiceResult<TaskVm>.Fail("Сотрудник не состоит в выбранном проекте");

            var stageName = dto.StageName?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(stageName))
                return ServiceResult<TaskVm>.Fail("Выберите этап проекта");

            var allowedStageNames = await GetAllowedProjectStageNamesAsync(project);
            if (!StageBelongsToProject(stageName, allowedStageNames))
                return ServiceResult<TaskVm>.Fail("Этап не относится к выбранному проекту");

            task.Title = dto.Name.Trim();
            task.Description = dto.Description?.Trim() ?? "";
            task.Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "medium" : dto.Priority;
            task.Status = NormalizeTaskStatus(dto.Status, task.Status);
            task.ProjectId = dto.ProjectId;
            task.UserId = performerId;
            task.Assignee = BuildFullName(performer.LastName, performer.FirstName, performer.MiddleName);
            task.PlannedTimeHours = dto.PlannedTime;
            task.Deadline = dto.Deadline;
            task.StageName = stageName;

            await _db.SaveChangesAsync();
            await _db.Entry(task).Reference(t => t.Project).LoadAsync();
            await _db.Entry(task).Reference(t => t.User).LoadAsync();

            return ServiceResult<TaskVm>.Success(MapTask(task));
        }

        public async Task<ServiceResult> DeleteTaskAsync(int currentUserId, int taskId)
        {
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);
            if (currentUser == null)
                return ServiceResult.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();

            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null)
                return ServiceResult.Fail("Задача не найдена");

            if (role == "employee")
                return ServiceResult.Fail("Нет прав");

            if (role == "manager" && task.Project?.ManagerId != currentUserId)
                return ServiceResult.Fail("Нет прав на эту задачу");

            _db.Tasks.Remove(task);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> DeleteProjectAsync(int currentUserId, int projectId)
        {
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);
            if (currentUser == null)
                return ServiceResult.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null)
                return ServiceResult.Fail("Проект не найден");

            if (role == "employee")
                return ServiceResult.Fail("Нет прав");

            if (role == "manager" && project.ManagerId != currentUserId)
                return ServiceResult.Fail("Нет прав на этот проект");

            var projectTasks = await _db.Tasks.Where(t => t.ProjectId == projectId).ToListAsync();
            if (projectTasks.Count > 0)
                _db.Tasks.RemoveRange(projectTasks);

            var projectMembers = await _db.ProjectMembers.Where(x => x.ProjectId == projectId).ToListAsync();
            if (projectMembers.Count > 0)
                _db.ProjectMembers.RemoveRange(projectMembers);

            _db.Projects.Remove(project);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult<ProjectVm>> AddProjectAsync(int userId, AddProjectDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return ServiceResult<ProjectVm>.Fail("Введите название проекта");

            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (currentUser == null)
                return ServiceResult<ProjectVm>.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();

            int managerId;

            if (role == "admin")
            {
                if (!dto.ManagerId.HasValue || dto.ManagerId.Value <= 0)
                    return ServiceResult<ProjectVm>.Fail("Выберите менеджера проекта");

                managerId = dto.ManagerId.Value;
            }
            else if (role == "manager")
            {
                managerId = currentUser.Id;
            }
            else
            {
                return ServiceResult<ProjectVm>.Fail("Нет прав");
            }

            var manager = await _db.Users.FirstOrDefaultAsync(x => x.Id == managerId);
            if (manager == null)
                return ServiceResult<ProjectVm>.Fail("Менеджер не найден");

            var project = new Project
            {
                Name = dto.Name.Trim(),
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                ManagerId = managerId,
                ProjectType = NormalizeProjectType(dto.ProjectType),
                StageNamesJson = SerializeStageNames(dto.StageNames)
            };

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            var memberIds = dto.MemberIds?.Distinct().ToList() ?? new List<int>();

            if (!memberIds.Contains(managerId))
                memberIds.Add(managerId);

            foreach (var memberId in memberIds)
            {
                var userExists = await _db.Users.AnyAsync(x => x.Id == memberId);
                if (!userExists)
                    continue;

                _db.ProjectMembers.Add(new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = memberId
                });
            }

            await _db.SaveChangesAsync();

            return ServiceResult<ProjectVm>.Success(new ProjectVm
            {
                Id = project.Id,
                Name = project.Name,
                Description = project.Description ?? "",
                TasksCount = 0,
                Progress = 0,
                ManagerId = project.ManagerId,
                ManagerName = BuildFullName(manager.LastName, manager.FirstName, manager.MiddleName),
                MemberIds = memberIds,
                MembersCount = memberIds.Count,
                ProjectType = project.ProjectType,
                ProjectTypeName = GetProjectTypeName(project.ProjectType),
                StageNames = ParseStageNames(project.StageNamesJson)
            });
        }



        public async Task<ServiceResult> StartWorkDayAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            if (user.IsWorking)
                return ServiceResult.Fail("Рабочий день уже начат");

            var activeDay = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "workday" &&
                a.IsActive);

            if (activeDay != null)
                return ServiceResult.Fail("Рабочий день уже начат");

            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer != null)
                return ServiceResult.Fail("Сначала завершите активный таймер");

            var now = DateTime.UtcNow;
            var plannedHours = user.RequiredDailyHours > 0 ? user.RequiredDailyHours : 8;

            var log = new ActivityLog
            {
                UserId = userId,
                ActivityType = "workday",
                StartedAtUtc = now,
                IsActive = true,
                DurationHours = 0m,
                IsIdle = false,
                PlannedHours = plannedHours,
                TrackedHours = 0,
                IdleHours = 0,
                OvertimeHours = 0,
                UnderworkHours = 0
            };

            user.IsWorking = true;
            user.WorkStartUtc = now;

            _db.ActivityLogs.Add(log);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }


        public async Task<ServiceResult<decimal>> StopWorkDayAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<decimal>.Fail("Пользователь не найден");

            var activeDay = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "workday" &&
                a.IsActive);

            if (activeDay == null)
                return ServiceResult<decimal>.Fail("Рабочий день не найден");

            var now = DateTime.UtcNow;

            var activeTimers = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "task_timer" &&
                    a.IsActive)
                .ToListAsync();

            foreach (var timer in activeTimers)
            {
                timer.EndedAtUtc = now;
                timer.IsActive = false;
                timer.DurationHours = Math.Round((decimal)(timer.EndedAtUtc.Value - timer.StartedAtUtc).TotalHours, 2);
            }

            await _db.SaveChangesAsync();

            var trackedTaskTimerHours = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "task_timer" &&
                    !a.IsActive &&
                    a.StartedAtUtc >= activeDay.StartedAtUtc &&
                    (a.EndedAtUtc ?? now) <= now)
                .SumAsync(a => (decimal?)a.DurationHours) ?? 0m;

            var trackedManualHours = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "manual_time" &&
                    a.StartedAtUtc >= activeDay.StartedAtUtc &&
                    (a.EndedAtUtc ?? a.StartedAtUtc) <= now)
                .SumAsync(a => (decimal?)a.DurationHours) ?? 0m;

            var trackedHours = Math.Round(trackedTaskTimerHours + trackedManualHours, 2);

            var totalDayHours = Math.Round((decimal)(now - activeDay.StartedAtUtc).TotalHours, 2);

            var idleHours = Math.Round(totalDayHours - trackedHours, 2);
            if (idleHours < 0)
                idleHours = 0;

            var plannedHours = activeDay.PlannedHours > 0
                ? activeDay.PlannedHours
                : (user.RequiredDailyHours > 0 ? user.RequiredDailyHours : 8m);

            var overtimeHours = totalDayHours > plannedHours
                ? totalDayHours - plannedHours
                : 0m;

            var underworkHours = totalDayHours < plannedHours
                ? plannedHours - totalDayHours
                : 0m;

            activeDay.EndedAtUtc = now;
            activeDay.IsActive = false;
            activeDay.DurationHours = totalDayHours;

            activeDay.PlannedHours = plannedHours;
            activeDay.TrackedHours = trackedHours;
            activeDay.IdleHours = idleHours;
            activeDay.OvertimeHours = overtimeHours;
            activeDay.UnderworkHours = underworkHours;

            user.IsWorking = false;
            user.WorkStartUtc = null;

            await _db.SaveChangesAsync();

            return ServiceResult<decimal>.Success(activeDay.DurationHours);
        }



        public async Task<ServiceResult> StartTaskTimerAsync(int userId, StartTaskTimerDto dto)
        {
            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == dto.TaskId);

            if (task == null)
                return ServiceResult.Fail("Задача не найдена");

            if (task.UserId != userId)
                return ServiceResult.Fail("Нельзя запускать чужую задачу");

            var activeDay = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "workday" &&
                a.IsActive);

            if (activeDay == null)
                return ServiceResult.Fail("Сначала начните рабочий день");

            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer != null)
                return ServiceResult.Fail("У вас уже запущен другой таймер");

            var log = new ActivityLog
            {
                UserId = userId,
                TaskItemId = task.Id,
                ProjectId = task.ProjectId,
                ActivityType = "task_timer",
                StartedAtUtc = DateTime.UtcNow,
                IsActive = true,
                DurationHours = 0m,
                Comment = dto.Comment?.Trim(),
                IsIdle = false
            };

            _db.ActivityLogs.Add(log);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult<decimal>> PauseTaskTimerAsync(int userId)
        {
            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer == null)
                return ServiceResult<decimal>.Fail("Активный таймер не найден");

            activeTimer.EndedAtUtc = DateTime.UtcNow;
            activeTimer.IsActive = false;
            activeTimer.DurationHours = Math.Round(
    (decimal)(activeTimer.EndedAtUtc.Value - activeTimer.StartedAtUtc).TotalHours, 2);

            await _db.SaveChangesAsync();

            return ServiceResult<decimal>.Success(activeTimer.DurationHours);
        }

        public async Task<ServiceResult<decimal>> StopTaskTimerAsync(int userId)
        {
            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer == null)
                return ServiceResult<decimal>.Fail("Активный таймер не найден");

            activeTimer.EndedAtUtc = DateTime.UtcNow;
            activeTimer.IsActive = false;
            activeTimer.DurationHours = Math.Round(
    (decimal)(activeTimer.EndedAtUtc.Value - activeTimer.StartedAtUtc).TotalHours, 2);

            await _db.SaveChangesAsync();

            return ServiceResult<decimal>.Success(activeTimer.DurationHours);
        }

        public async Task<ServiceResult<ActivityVm>> AddManualTimeAsync(int userId, AddManualTimeDto dto)
        {
            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == dto.TaskId);
            if (task == null)
                return ServiceResult<ActivityVm>.Fail("Задача не найдена");

            if (task.UserId != userId)
                return ServiceResult<ActivityVm>.Fail("Нельзя добавлять время по чужой задаче");

            if (dto.Hours <= 0)
                return ServiceResult<ActivityVm>.Fail("Введите корректное количество часов");

            var now = DateTime.UtcNow;

            var log = new ActivityLog
            {
                UserId = userId,
                TaskItemId = task.Id,
                ProjectId = task.ProjectId,
                ActivityType = "manual_time",
                StartedAtUtc = now.AddHours(-(double)dto.Hours),
                EndedAtUtc = now,
                DurationHours = Math.Round((decimal)dto.Hours, 2),
                Comment = dto.Comment?.Trim(),
                IsActive = false,
                IsIdle = false
            };

            _db.ActivityLogs.Add(log);
            await _db.SaveChangesAsync();

            return ServiceResult<ActivityVm>.Success(new ActivityVm
            {
                Date = now.ToLocalTime().ToString("dd.MM.yyyy"),
                Task = task.Title,
                Hours = log.DurationHours,
                Comment = log.Comment ?? "Без комментария"
            });
        }

        private static DateTime? ParseManualRequestWorkDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            if (DateTime.TryParseExact(
                value.Trim(),
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed))
            {
                return parsed.Date;
            }

            return null;
        }

        private static string BuildManualRequestCommentPayload(DateTime workDate, string reason, string comment)
        {
            var payload = new ManualTimeRequestMeta
            {
                WorkDate = workDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Reason = reason.Trim(),
                Comment = comment.Trim()
            };

            return ManualRequestMetaPrefix + JsonSerializer.Serialize(payload);
        }

        private static ManualTimeRequestData ParseManualRequestData(string? storedComment)
        {
            if (!string.IsNullOrWhiteSpace(storedComment) && storedComment.StartsWith(ManualRequestMetaPrefix, StringComparison.Ordinal))
            {
                var rawJson = storedComment[ManualRequestMetaPrefix.Length..];

                try
                {
                    var payload = JsonSerializer.Deserialize<ManualTimeRequestMeta>(rawJson);
                    var workDate = ParseManualRequestWorkDate(payload?.WorkDate);

                    return new ManualTimeRequestData
                    {
                        WorkDate = workDate,
                        WorkDateValue = workDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        Reason = payload?.Reason?.Trim() ?? "",
                        Comment = payload?.Comment?.Trim() ?? ""
                    };
                }
                catch (JsonException)
                {
                }
            }

            return new ManualTimeRequestData
            {
                Comment = storedComment?.Trim() ?? ""
            };
        }

        private static (DateTime startedAtUtc, DateTime endedAtUtc) BuildManualTimeRangeUtc(User user, DateTime workDate, decimal hours)
        {
            var startTime = user.PlannedStartTime ?? new TimeSpan(9, 0, 0);
            var localStart = DateTime.SpecifyKind(workDate.Date.Add(startTime), DateTimeKind.Local);
            var localEnd = localStart.AddHours((double)hours);

            return (localStart.ToUniversalTime(), localEnd.ToUniversalTime());
        }

        private static ManualTimeRequestVm MapManualTimeRequestVm(ManualTimeRequest request)
        {
            var parsed = ParseManualRequestData(request.Comment);

            return new ManualTimeRequestVm
            {
                Id = request.Id,
                Employee = request.User == null ? "" : BuildFullName(request.User.LastName, request.User.FirstName, request.User.MiddleName),
                UserId = request.UserId,
                TaskId = request.TaskItemId,
                TaskName = request.TaskItem?.Title ?? "Без задачи",
                ProjectName = request.TaskItem?.Project?.Name ?? "Без проекта",
                Hours = request.Hours,
                Comment = parsed.Comment,
                Reason = parsed.Reason,
                WorkDate = parsed.WorkDate?.ToString("dd.MM.yyyy") ?? "-",
                WorkDateValue = parsed.WorkDateValue,
                Status = request.Status,
                CreatedAt = request.CreatedAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                ReviewedAt = request.ReviewedAtUtc.HasValue ? request.ReviewedAtUtc.Value.ToLocalTime().ToString("dd.MM.yyyy HH:mm") : "",
                ManagerComment = request.ManagerComment,
                AttachmentPath = request.AttachmentPath,
                AttachmentName = request.AttachmentName,
                CanResubmit = string.Equals(request.Status, "needs_revision", StringComparison.OrdinalIgnoreCase)
            };
        }

        private async Task RecalculateWorkDaySummariesAsync(int userId, DateTime fromUtc, DateTime toUtc)
        {
            var workDays = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "workday" &&
                    !a.IsActive &&
                    a.StartedAtUtc <= toUtc &&
                    (a.EndedAtUtc ?? a.StartedAtUtc) >= fromUtc)
                .ToListAsync();

            if (!workDays.Any())
                return;

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);

            foreach (var workDay in workDays)
            {
                var workDayEnd = workDay.EndedAtUtc ?? workDay.StartedAtUtc;

                var trackedLogs = await _db.ActivityLogs
                    .Where(a =>
                        a.UserId == userId &&
                        (a.ActivityType == "task_timer" || a.ActivityType == "manual_time") &&
                        a.StartedAtUtc <= workDayEnd &&
                        (a.EndedAtUtc ?? a.StartedAtUtc) >= workDay.StartedAtUtc)
                    .ToListAsync();

                decimal trackedHours = 0m;

                foreach (var trackedLog in trackedLogs)
                {
                    var trackedLogEnd = trackedLog.EndedAtUtc ?? trackedLog.StartedAtUtc;
                    var overlapStart = trackedLog.StartedAtUtc > workDay.StartedAtUtc
                        ? trackedLog.StartedAtUtc
                        : workDay.StartedAtUtc;
                    var overlapEnd = trackedLogEnd < workDayEnd
                        ? trackedLogEnd
                        : workDayEnd;

                    if (overlapEnd > overlapStart)
                    {
                        trackedHours += Math.Round((decimal)(overlapEnd - overlapStart).TotalHours, 2);
                    }
                }

                var totalDayHours = workDay.DurationHours > 0
                    ? workDay.DurationHours
                    : Math.Round((decimal)(workDayEnd - workDay.StartedAtUtc).TotalHours, 2);

                var plannedHours = workDay.PlannedHours > 0
                    ? workDay.PlannedHours
                    : (user?.RequiredDailyHours > 0 ? user.RequiredDailyHours : 8m);

                trackedHours = Math.Round(trackedHours, 2);

                workDay.TrackedHours = trackedHours;
                workDay.IdleHours = Math.Max(0m, Math.Round(totalDayHours - trackedHours, 2));
                workDay.OvertimeHours = totalDayHours > plannedHours
                    ? Math.Round(totalDayHours - plannedHours, 2)
                    : 0m;
                workDay.UnderworkHours = totalDayHours < plannedHours
                    ? Math.Round(plannedHours - totalDayHours, 2)
                    : 0m;
            }

            await _db.SaveChangesAsync();
        }

        public async Task<ServiceResult<ManualTimeRequestVm>> CreateManualTimeRequestAsync(int userId, AddManualTimeDto dto)
        {
            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == dto.TaskId);

            if (task == null)
                return ServiceResult<ManualTimeRequestVm>.Fail("Задача не найдена");

            if (task.UserId != userId)
                return ServiceResult<ManualTimeRequestVm>.Fail("Нельзя отправлять время по чужой задаче");

            if (dto.Hours <= 0)
                return ServiceResult<ManualTimeRequestVm>.Fail("Введите корректное количество часов");

            var workDate = ParseManualRequestWorkDate(dto.WorkDate);
            if (!workDate.HasValue)
                return ServiceResult<ManualTimeRequestVm>.Fail("Укажите дату выполненной работы");

            var reason = (dto.Reason ?? "").Trim();
            if (string.IsNullOrWhiteSpace(reason))
                return ServiceResult<ManualTimeRequestVm>.Fail("Укажите причину ручного добавления времени");

            var comment = (dto.Comment ?? "").Trim();
            if (string.IsNullOrWhiteSpace(comment))
                return ServiceResult<ManualTimeRequestVm>.Fail("Комментарий к заявке обязателен");

            if (string.IsNullOrWhiteSpace(dto.AttachmentPath) || string.IsNullOrWhiteSpace(dto.AttachmentName))
                return ServiceResult<ManualTimeRequestVm>.Fail("К заявке нужно прикрепить файл-подтверждение");

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<ManualTimeRequestVm>.Fail("Пользователь не найден");

            var request = new ManualTimeRequest
            {
                UserId = userId,
                TaskItemId = task.Id,
                ProjectId = task.ProjectId,
                Hours = dto.Hours,
                Comment = BuildManualRequestCommentPayload(workDate.Value, reason, comment),
                Status = "pending",
                CreatedAtUtc = DateTime.UtcNow,
                AttachmentPath = dto.AttachmentPath,
                AttachmentName = dto.AttachmentName
            };

            request.User = user;
            request.TaskItem = task;
            _db.ManualTimeRequests.Add(request);
            await _db.SaveChangesAsync();

            return ServiceResult<ManualTimeRequestVm>.Success(MapManualTimeRequestVm(request));
        }

        public async Task<ServiceResult<ManualTimeRequestVm>> UpdateManualTimeRequestAsync(int userId, AddManualTimeDto dto)
        {
            if (dto.RequestId <= 0)
                return ServiceResult<ManualTimeRequestVm>.Fail("Заявка не найдена");

            var request = await _db.ManualTimeRequests
                .Include(x => x.User)
                .Include(x => x.TaskItem)
                    .ThenInclude(t => t!.Project)
                .FirstOrDefaultAsync(x => x.Id == dto.RequestId);

            if (request == null)
                return ServiceResult<ManualTimeRequestVm>.Fail("Заявка не найдена");

            if (request.UserId != userId)
                return ServiceResult<ManualTimeRequestVm>.Fail("Нельзя изменять чужую заявку");

            if (!string.Equals(request.Status, "needs_revision", StringComparison.OrdinalIgnoreCase))
                return ServiceResult<ManualTimeRequestVm>.Fail("Редактировать можно только заявку, возвращённую на доработку");

            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == dto.TaskId);

            if (task == null)
                return ServiceResult<ManualTimeRequestVm>.Fail("Задача не найдена");

            if (task.UserId != userId)
                return ServiceResult<ManualTimeRequestVm>.Fail("Нельзя отправлять время по чужой задаче");

            if (dto.Hours <= 0)
                return ServiceResult<ManualTimeRequestVm>.Fail("Введите корректное количество часов");

            var workDate = ParseManualRequestWorkDate(dto.WorkDate);
            if (!workDate.HasValue)
                return ServiceResult<ManualTimeRequestVm>.Fail("Укажите дату выполненной работы");

            var reason = (dto.Reason ?? "").Trim();
            if (string.IsNullOrWhiteSpace(reason))
                return ServiceResult<ManualTimeRequestVm>.Fail("Укажите причину ручного добавления времени");

            var comment = (dto.Comment ?? "").Trim();
            if (string.IsNullOrWhiteSpace(comment))
                return ServiceResult<ManualTimeRequestVm>.Fail("Комментарий к заявке обязателен");

            var hasAttachment = !string.IsNullOrWhiteSpace(dto.AttachmentPath) || !string.IsNullOrWhiteSpace(request.AttachmentPath);
            if (!hasAttachment)
                return ServiceResult<ManualTimeRequestVm>.Fail("К заявке нужно прикрепить файл-подтверждение");

            request.TaskItemId = task.Id;
            request.ProjectId = task.ProjectId;
            request.Hours = dto.Hours;
            request.Comment = BuildManualRequestCommentPayload(workDate.Value, reason, comment);
            request.Status = "pending";
            request.CreatedAtUtc = DateTime.UtcNow;
            request.ReviewedAtUtc = null;
            request.ReviewedByUserId = null;

            if (!string.IsNullOrWhiteSpace(dto.AttachmentPath) && !string.IsNullOrWhiteSpace(dto.AttachmentName))
            {
                request.AttachmentPath = dto.AttachmentPath;
                request.AttachmentName = dto.AttachmentName;
            }

            request.TaskItem = task;
            await _db.SaveChangesAsync();

            return ServiceResult<ManualTimeRequestVm>.Success(MapManualTimeRequestVm(request));
        }

        public async Task<List<ManualTimeRequestVm>> GetManualTimeRequestsAsync(int currentUserId, string currentUserRole)
        {
            var role = (currentUserRole ?? "").ToLower();

            IQueryable<ManualTimeRequest> query = _db.ManualTimeRequests
                .Include(x => x.User)
                .Include(x => x.TaskItem)
                    .ThenInclude(t => t!.Project)
                .OrderByDescending(x => x.CreatedAtUtc);

            if (role == "manager")
            {
                var managerProjectIds = await _db.Projects
                    .Where(p => p.ManagerId == currentUserId)
                    .Select(p => p.Id)
                    .ToListAsync();

                query = query.Where(x => x.ProjectId.HasValue && managerProjectIds.Contains(x.ProjectId.Value))
             .OrderByDescending(x => x.CreatedAtUtc);
            }
            else if (role == "employee")
            {
                query = query.Where(x => x.UserId == currentUserId)
                             .OrderByDescending(x => x.CreatedAtUtc);
            }

            var list = await query.ToListAsync();

            return list.Select(MapManualTimeRequestVm).ToList();
        }

        public async Task<ServiceResult> ApproveManualTimeRequestAsync(int currentUserId, string currentUserRole, ApproveManualTimeDto dto)
        {
            var role = (currentUserRole ?? "").ToLower();
            if (role != "manager" && role != "admin")
                return ServiceResult.Fail("Нет прав");

            var request = await _db.ManualTimeRequests
                .Include(x => x.TaskItem)
                .FirstOrDefaultAsync(x => x.Id == dto.Id);

            if (request == null)
                return ServiceResult.Fail("Заявка не найдена");

            if (request.Status != "pending")
                return ServiceResult.Fail("Заявка уже обработана");

            if (role == "manager")
            {
                var allowed = await _db.Projects.AnyAsync(p =>
                    p.Id == request.ProjectId &&
                    p.ManagerId == currentUserId);

                if (!allowed)
                    return ServiceResult.Fail("Нет прав");
            }

            request.Status = "approved";
            request.ManagerComment = dto.ManagerComment?.Trim();
            request.ReviewedAtUtc = DateTime.UtcNow;
            request.ReviewedByUserId = currentUserId;

            var requestData = ParseManualRequestData(request.Comment);
            var workDate = requestData.WorkDate ?? request.CreatedAtUtc.ToLocalTime().Date;
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == request.UserId);

            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            var (startedAtUtc, endedAtUtc) = BuildManualTimeRangeUtc(user, workDate, request.Hours);

            var log = new ActivityLog
            {
                UserId = request.UserId,
                TaskItemId = request.TaskItemId,
                ProjectId = request.ProjectId,
                ActivityType = "manual_time",
                StartedAtUtc = startedAtUtc,
                EndedAtUtc = endedAtUtc,
                DurationHours = Math.Round((decimal)request.Hours, 2),
                Comment = string.IsNullOrWhiteSpace(requestData.Comment)
                    ? "Ручное время одобрено менеджером"
                    : requestData.Comment,
                IsActive = false,
                IsIdle = false
            };

            _db.ActivityLogs.Add(log);
            await _db.SaveChangesAsync();
            await RecalculateWorkDaySummariesAsync(request.UserId, startedAtUtc, endedAtUtc);

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> ReturnManualTimeRequestForRevisionAsync(int currentUserId, string currentUserRole, NeedsRevisionManualTimeDto dto)
        {
            var role = (currentUserRole ?? "").ToLower();
            if (role != "manager" && role != "admin")
                return ServiceResult.Fail("Нет прав");

            var request = await _db.ManualTimeRequests.FirstOrDefaultAsync(x => x.Id == dto.Id);

            if (request == null)
                return ServiceResult.Fail("Заявка не найдена");

            if (request.Status != "pending")
                return ServiceResult.Fail("На доработку можно вернуть только новую заявку");

            if (role == "manager")
            {
                var allowed = await _db.Projects.AnyAsync(p =>
                    p.Id == request.ProjectId &&
                    p.ManagerId == currentUserId);

                if (!allowed)
                    return ServiceResult.Fail("Нет прав");
            }

            var managerComment = dto.ManagerComment?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(managerComment))
                return ServiceResult.Fail("Укажите, что нужно исправить");

            request.Status = "needs_revision";
            request.ManagerComment = managerComment;
            request.ReviewedAtUtc = DateTime.UtcNow;
            request.ReviewedByUserId = currentUserId;

            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> RejectManualTimeRequestAsync(int currentUserId, string currentUserRole, RejectManualTimeDto dto)
        {
            var role = (currentUserRole ?? "").ToLower();
            if (role != "manager" && role != "admin")
                return ServiceResult.Fail("Нет прав");

            var request = await _db.ManualTimeRequests.FirstOrDefaultAsync(x => x.Id == dto.Id);

            if (request == null)
                return ServiceResult.Fail("Заявка не найдена");

            if (request.Status != "pending")
                return ServiceResult.Fail("Заявка уже обработана");

            if (role == "manager")
            {
                var allowed = await _db.Projects.AnyAsync(p =>
                    p.Id == request.ProjectId &&
                    p.ManagerId == currentUserId);

                if (!allowed)
                    return ServiceResult.Fail("Нет прав");
            }

            var managerComment = dto.ManagerComment?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(managerComment))
                return ServiceResult.Fail("Укажите причину отклонения");

            request.Status = "rejected";
            request.ManagerComment = managerComment;
            request.ReviewedAtUtc = DateTime.UtcNow;
            request.ReviewedByUserId = currentUserId;

            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> ChangePasswordAsync(int userId, string oldPassword, string newPassword)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);

            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            var oldPasswordHash = HashPassword(oldPassword);

            if (user.PasswordHash != oldPasswordHash)
                return ServiceResult.Fail("Старый пароль неверный");

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
                return ServiceResult.Fail("Пароль слишком короткий");

            user.PasswordHash = HashPassword(newPassword);

            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult<UserVm>> AddUserAsync(AddUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LastName) ||
                string.IsNullOrWhiteSpace(dto.FirstName) ||
                string.IsNullOrWhiteSpace(dto.Login) ||
                string.IsNullOrWhiteSpace(dto.Password) ||
                string.IsNullOrWhiteSpace(dto.Position))
            {
                return ServiceResult<UserVm>.Fail("Заполните обязательные поля");
            }

            var loginExists = await _db.Users.AnyAsync(x => x.Login == dto.Login.Trim());
            if (loginExists)
                return ServiceResult<UserVm>.Fail("Логин уже существует");

            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(email))
            {
                var emailExists = await _db.Users.AnyAsync(x => x.Email == email);
                if (emailExists)
                    return ServiceResult<UserVm>.Fail("Email уже существует");
            }


            var workMode = (dto.WorkMode ?? "fixed").Trim().ToLower();
            if (workMode != "fixed" && workMode != "flexible")
                workMode = "fixed";

            TimeSpan? plannedStartTime = null;
            TimeSpan? plannedEndTime = null;

            if (workMode == "fixed")
            {
                if (dto.RequiredDailyHours <= 0)
                    return ServiceResult<UserVm>.Fail("Для фиксированного графика укажите норму часов");

                if (!string.IsNullOrWhiteSpace(dto.PlannedStartTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedStartTime, out var start))
                        return ServiceResult<UserVm>.Fail("Некорректное время начала рабочего дня");
                    plannedStartTime = start;
                }

                if (!string.IsNullOrWhiteSpace(dto.PlannedEndTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedEndTime, out var end))
                        return ServiceResult<UserVm>.Fail("Некорректное время окончания рабочего дня");
                    plannedEndTime = end;
                }

                if (plannedStartTime.HasValue && plannedEndTime.HasValue && plannedEndTime <= plannedStartTime)
                    return ServiceResult<UserVm>.Fail("Время окончания должно быть позже времени начала");
            }
            else
            {
                if (dto.RequiredDailyHours < 0)
                    return ServiceResult<UserVm>.Fail("Норма часов не может быть отрицательной");
            }


            var user = new User
            {
                LastName = dto.LastName.Trim(),
                FirstName = dto.FirstName.Trim(),
                MiddleName = dto.MiddleName?.Trim(),
                Login = dto.Login.Trim(),
                Email = email,
                PasswordHash = HashPassword(dto.Password.Trim()),
                Position = dto.Position.Trim(),
                Role = NormalizeRole(dto.Role),
                HourlyRate = dto.Rate,
                Phone = dto.Phone?.Trim(),
                IsActive = dto.Status != "blocked",

                WorkMode = workMode,
                RequiredDailyHours = dto.RequiredDailyHours,
                PlannedStartTime = plannedStartTime,
                PlannedEndTime = plannedEndTime,
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }

        public async Task<ServiceResult<UserVm>> UpdateUserAsync(UpdateUserDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == dto.Id);
            if (user == null)
                return ServiceResult<UserVm>.Fail("Сотрудник не найден");

            if (string.IsNullOrWhiteSpace(dto.LastName) ||
                string.IsNullOrWhiteSpace(dto.FirstName) ||
                string.IsNullOrWhiteSpace(dto.Login) ||
                string.IsNullOrWhiteSpace(dto.Position))
            {
                return ServiceResult<UserVm>.Fail("Заполните обязательные поля");
            }

            var loginExists = await _db.Users.AnyAsync(x => x.Login == dto.Login.Trim() && x.Id != dto.Id);
            if (loginExists)
                return ServiceResult<UserVm>.Fail("Логин уже существует");

            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(email))
            {
                var emailExists = await _db.Users.AnyAsync(x => x.Email == email && x.Id != dto.Id);
                if (emailExists)
                    return ServiceResult<UserVm>.Fail("Email уже существует");
            }


            var workMode = (dto.WorkMode ?? "fixed").Trim().ToLower();
            if (workMode != "fixed" && workMode != "flexible")
                workMode = "fixed";

            TimeSpan? plannedStartTime = null;
            TimeSpan? plannedEndTime = null;

            if (workMode == "fixed")
            {
                if (dto.RequiredDailyHours <= 0)
                    return ServiceResult<UserVm>.Fail("Для фиксированного графика укажите норму часов");

                if (!string.IsNullOrWhiteSpace(dto.PlannedStartTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedStartTime, out var start))
                        return ServiceResult<UserVm>.Fail("Некорректное время начала рабочего дня");
                    plannedStartTime = start;
                }

                if (!string.IsNullOrWhiteSpace(dto.PlannedEndTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedEndTime, out var end))
                        return ServiceResult<UserVm>.Fail("Некорректное время окончания рабочего дня");
                    plannedEndTime = end;
                }

                if (plannedStartTime.HasValue && plannedEndTime.HasValue && plannedEndTime <= plannedStartTime)
                    return ServiceResult<UserVm>.Fail("Время окончания должно быть позже времени начала");
            }
            else
            {
                if (dto.RequiredDailyHours < 0)
                    return ServiceResult<UserVm>.Fail("Норма часов не может быть отрицательной");
            }


            user.LastName = dto.LastName.Trim();
            user.FirstName = dto.FirstName.Trim();
            user.MiddleName = dto.MiddleName?.Trim();
            user.Login = dto.Login.Trim();
            user.Email = email;
            user.Position = dto.Position.Trim();
            user.Role = NormalizeRole(dto.Role);
            user.HourlyRate = dto.Rate;
            user.Phone = dto.Phone?.Trim();
            user.IsActive = dto.Status != "blocked";
            user.WorkMode = workMode;
            user.RequiredDailyHours = dto.RequiredDailyHours;
            user.PlannedStartTime = plannedStartTime;
            user.PlannedEndTime = plannedEndTime;

            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.PasswordHash = HashPassword(dto.Password.Trim());

            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }
        private static string NormalizeRole(string? role)
        {
            var value = (role ?? "").Trim().ToLower();

            return value switch
            {
                "admin" => "admin",
                "manager" => "manager",
                _ => "employee"
            };
        }
        public async Task<ServiceResult<UserVm>> ToggleUserStatusAsync(int id)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
            if (user == null)
                return ServiceResult<UserVm>.Fail("Сотрудник не найден");

            user.IsActive = !user.IsActive;
            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }

        private static string GetActivityComment(string? activityType)
        {
            return activityType switch
            {
                "task_timer" => "Сессия таймера",
                "manual_time" => "Ручное добавление времени",
                _ => "Активность"
            };
        }

        private static TaskVm MapTask(TaskItem t)
        {
            return new TaskVm
            {
                Id = t.Id,
                Name = t.Title,
                Description = t.Description,
                Project = t.Project?.Name ?? "",
                ProjectId = t.ProjectId,
                UserId = t.UserId,
                Assignee = t.User != null
    ? BuildFullName(t.User.LastName, t.User.FirstName, t.User.MiddleName)
    : (t.Assignee ?? ""),
                Priority = t.Priority,
                Status = t.Status,
                PlannedTime = t.PlannedTimeHours,
                Deadline = t.Deadline?.ToString("dd.MM.yyyy") ?? "",
                DeadlineRaw = t.Deadline?.ToString("yyyy-MM-dd") ?? "",
                StageName = t.StageName ?? ""
            };
        }

        private static List<string> ParseStageNames(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<string>();
            }

            try
            {
                var items = JsonSerializer.Deserialize<List<string>>(json);
                return items?
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct()
                    .ToList()
                    ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private static string NormalizeTaskStatus(string? status, string fallback = "new")
        {
            var value = (status ?? "").Trim().ToLower();
            var fallbackValue = (fallback ?? "").Trim().ToLower();

            return value switch
            {
                "new" => "new",
                "progress" => "progress",
                "review" => "review",
                "done" => "done",
                _ => fallbackValue switch
                {
                    "new" => "new",
                    "progress" => "progress",
                    "review" => "review",
                    "done" => "done",
                    _ => "new"
                }
            };
        }

        private async Task<List<string>> GetAllowedProjectStageNamesAsync(Project project)
        {
            var stageNames = ParseStageNames(project.StageNamesJson);

            if (stageNames.Count == 0)
            {
                stageNames = GetProjectPresetStageNames(project.ProjectType);
            }

            var taskStageNames = await _db.Tasks
                .Where(t => t.ProjectId == project.Id && t.StageName != null && t.StageName != "")
                .Select(t => t.StageName!)
                .ToListAsync();

            stageNames.AddRange(taskStageNames
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x)));

            return stageNames
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static bool StageBelongsToProject(string stageName, List<string> allowedStageNames)
        {
            return allowedStageNames.Any(x =>
                string.Equals(x, stageName, StringComparison.OrdinalIgnoreCase));
        }

        private static List<string> GetProjectPresetStageNames(string? projectType)
        {
            return NormalizeProjectType(projectType) switch
            {
                "linear" => new List<string> { "Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск" },
                "hybrid" => new List<string> { "Подготовка", "Разработка / Backend", "Разработка / Frontend", "Сдача / QA", "Сдача / Релиз" },
                _ => new List<string> { "Backend", "Frontend", "UI/UX", "QA", "Docs" }
            };
        }

        private static string SerializeStageNames(List<string>? items)
        {
            var clean = (items ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct()
                .ToList();

            return JsonSerializer.Serialize(clean);
        }

        private static string NormalizeProjectType(string? value)
        {
            var type = (value ?? "").Trim().ToLower();

            if (type == "linear" || type == "functional" || type == "hybrid")
            {
                return type;
            }

            return "functional";
        }

        private static string GetProjectTypeName(string? value)
        {
            var type = NormalizeProjectType(value);

            if (type == "linear")
            {
                return "Линейный";
            }

            if (type == "hybrid")
            {
                return "Гибридный";
            }

            return "Функциональный";
        }

        private async Task<ProjectVm> BuildProjectVm(Project p)
        {
            var tasks = await _db.Tasks
                .Where(x => x.ProjectId == p.Id)
                .ToListAsync();

            var memberIds = p.Members
                .Select(x => x.UserId)
                .Distinct()
                .ToList();

            var stageNames = ParseStageNames(p.StageNamesJson);

            if (stageNames.Count == 0)
            {
                stageNames = new List<string>();
            }

            var tasksCount = tasks.Count;
            var doneCount = tasks.Count(x => x.Status == "done");
            var progress = tasksCount == 0
                ? 0
                : (int)Math.Round(doneCount * 100.0 / tasksCount);

            return new ProjectVm
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                CreatedAt = p.CreatedAt,
                TasksCount = tasks.Count,
                Progress = progress,
                ManagerId = p.ManagerId,
                ManagerName = p.Manager != null
                    ? BuildFullName(p.Manager.LastName, p.Manager.FirstName, p.Manager.MiddleName)
                    : "",
                MemberIds = memberIds,
                MembersCount = memberIds.Count,
                ProjectType = p.ProjectType,
                ProjectTypeName = GetProjectTypeName(p.ProjectType),
                StageNames = stageNames
            };
        }

        private static ActivityVm BuildActivityVm(ActivityLog a)
        {
            return new ActivityVm
            {
                Date = a.EndedAtUtc.HasValue
                    ? a.EndedAtUtc.Value.ToLocalTime().ToString("dd.MM.yyyy")
                    : a.StartedAtUtc.ToLocalTime().ToString("dd.MM.yyyy"),
                Task = a.TaskItem?.Title ?? "Без задачи",
                Hours = a.DurationHours,
                Comment = a.Comment ?? GetActivityComment(a.ActivityType)
            };
        }

        private static UserVm BuildUserVm(User u, List<TaskItem> allTasks, List<ActivityLog> allActivities)
        {
            var userTasks = allTasks.Where(t => t.UserId == u.Id).ToList();
            var userLogs = allActivities.Where(a => a.UserId == u.Id).ToList();

            var workDayLogs = userLogs
                .Where(a => a.ActivityType == "workday" && !a.IsActive)
                .ToList();

            var taskLogs = userLogs
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToList();

            var metrics = CalculatePerformanceMetrics(userTasks, taskLogs, workDayLogs, DateTime.Today);
            var completionPercent = metrics.TimeCompletionPercent > 999m
                ? 999m
                : metrics.TimeCompletionPercent;
            var bonusAmount = Math.Round(metrics.SalaryHours * u.HourlyRate * metrics.BonusPercent / 100m, 2);

            return new UserVm
            {
                Id = u.Id,
                FullName = BuildFullName(u.LastName, u.FirstName, u.MiddleName),
                Login = u.Login ?? "",
                Position = u.Position ?? "",
                Role = string.IsNullOrWhiteSpace(u.Role) ? "employee" : u.Role,
                HourlyRate = u.HourlyRate,
                Status = u.IsActive ? "active" : "blocked",
                Email = u.Email ?? "",
                Phone = u.Phone ?? "",

                TasksInProgress = metrics.OpenTasks,
                CompletedTasks = metrics.DoneTasks,
                OverdueTasks = metrics.OverdueTasks,

                PlannedHours = metrics.PlannedHours,
                TotalHours = metrics.TrackedHours,

                WorkMode = u.WorkMode ?? "fixed",
                RequiredDailyHours = u.RequiredDailyHours,
                PlannedStartTime = u.PlannedStartTime?.ToString(@"hh\:mm") ?? "",
                PlannedEndTime = u.PlannedEndTime?.ToString(@"hh\:mm") ?? "",

                WorkDayHours = metrics.WorkDayHours,
                TrackedHours = metrics.TrackedHours,
                IdleHours = metrics.IdleHours,
                SalaryHours = metrics.SalaryHours,

                WorkloadDiff = metrics.WorkloadDiff,
                CompletionPercent = completionPercent,
                ProductivityState = metrics.ProductivityState,
                BonusPercent = metrics.BonusPercent,
                BonusReason = metrics.BonusReason,
                BonusAmount = bonusAmount
            };
        }

        public class ReportDataVm
        {
            public string UserName { get; set; } = "";
            public decimal TotalHours { get; set; }
            public int CompletedTasks { get; set; }
            public decimal OvertimeHours { get; set; }
            public decimal PlannedHours { get; set; }
            public decimal ActualHours { get; set; }
            public int Efficiency { get; set; }
            public int OverdueCount { get; set; }
            public int BonusPercent { get; set; }
            public decimal BonusAmount { get; set; }
            public string BonusReason { get; set; } = "";
            public List<ReportEntryVm> Entries { get; set; } = new();
            public List<ChartItemVm> ByProjects { get; set; } = new();
            public List<ChartItemVm> ByDays { get; set; } = new();
            public List<OverdueTaskVm> OverdueTasks { get; set; } = new();
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

        private static string HashPassword(string value)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            return Convert.ToHexString(
                sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))
            );
        }




        public async Task<object?> GetCurrentWorkDayStatusAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return null;

            var activeDay = await _db.ActivityLogs
                .FirstOrDefaultAsync(a =>
                    a.UserId == userId &&
                    a.ActivityType == "workday" &&
                    a.IsActive);

            var requiredDailyHours = user.RequiredDailyHours > 0 ? user.RequiredDailyHours : 8m;
            var workMode = string.IsNullOrWhiteSpace(user.WorkMode) ? "fixed" : user.WorkMode;

            if (activeDay == null)
            {
                return new
                {
                    isWorking = false,
                    workMode = workMode,
                    requiredDailyHours = requiredDailyHours,
                    plannedStartTime = user.PlannedStartTime?.ToString(@"hh\:mm"),
                    plannedEndTime = user.PlannedEndTime?.ToString(@"hh\:mm"),
                    idleTimeoutMinutes = user.IdleTimeoutMinutes > 0 ? user.IdleTimeoutMinutes : 3,
                    startedAt = "",
                    currentHours = 0m,
                    trackedHours = 0m,
                    idleHours = 0m,
                    remainingHours = requiredDailyHours,
                    remainingByTrackedHours = requiredDailyHours,
                    remainingToPlannedEndHours = 0m
                };
            }

            var now = DateTime.UtcNow;
            var currentDayHours = Math.Round((decimal)(now - activeDay.StartedAtUtc).TotalHours, 2);

            var taskTimerLogs = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "task_timer" &&
                    a.StartedAtUtc >= activeDay.StartedAtUtc)
                .ToListAsync();

            var manualLogs = await _db.ActivityLogs
                .Where(a =>
                    a.UserId == userId &&
                    a.ActivityType == "manual_time" &&
                    a.StartedAtUtc >= activeDay.StartedAtUtc &&
                    (a.EndedAtUtc ?? a.StartedAtUtc) <= now)
                .ToListAsync();

            decimal tracked = 0m;

            foreach (var item in taskTimerLogs)
            {
                if (item.IsActive)
                    tracked += Math.Round((decimal)(now - item.StartedAtUtc).TotalHours, 2);
                else
                    tracked += item.DurationHours;
            }

            tracked += manualLogs.Sum(x => x.DurationHours);
            tracked = Math.Round(tracked, 2);

            var idle = currentDayHours - tracked;
            if (idle < 0)
                idle = 0m;

            var remainingHours = requiredDailyHours - currentDayHours;
            if (remainingHours < 0)
                remainingHours = 0m;

            var remainingByTrackedHours = requiredDailyHours - tracked;
            if (remainingByTrackedHours < 0)
                remainingByTrackedHours = 0m;

            decimal remainingToPlannedEndHours = 0m;

            if (workMode == "fixed" && user.PlannedEndTime.HasValue)
            {
                var localNow = DateTime.Now;
                var plannedEndToday = localNow.Date.Add(user.PlannedEndTime.Value);

                remainingToPlannedEndHours = Math.Round(
                    (decimal)(plannedEndToday - localNow).TotalHours,
                    2
                );

                if (remainingToPlannedEndHours < 0)
                    remainingToPlannedEndHours = 0m;
            }

            return new
            {
                isWorking = true,
                startedAt = activeDay.StartedAtUtc.ToLocalTime().ToString("HH:mm"),
                currentHours = currentDayHours,
                trackedHours = tracked,
                idleHours = idle,
                remainingHours = remainingHours,
                remainingByTrackedHours = remainingByTrackedHours,
                remainingToPlannedEndHours = remainingToPlannedEndHours,
                workMode = workMode,
                requiredDailyHours = requiredDailyHours,
                plannedStartTime = user.PlannedStartTime?.ToString(@"hh\:mm"),
                plannedEndTime = user.PlannedEndTime?.ToString(@"hh\:mm"),
                idleTimeoutMinutes = user.IdleTimeoutMinutes > 0 ? user.IdleTimeoutMinutes : 3
            };
        }



    }



    public class PageDataResult
    {
        public List<TaskVm> Tasks { get; set; } = new();
        public List<ProjectVm> Projects { get; set; } = new();
        public List<ActivityVm> Activity { get; set; } = new();
        public List<UserVm> Users { get; set; } = new();

        public List<WorkDayVm> WorkDays { get; set; } = new();
    }
    public class WorkDayVm
    {
        public string Date { get; set; } = "";
        public string Start { get; set; } = "";
        public string End { get; set; } = "";
        public decimal Hours { get; set; }
    }
    public class AdminAnalyticsVm
    {
        public List<UserVm> Users { get; set; } = new();
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int ManagersCount { get; set; }
        public double AverageRate { get; set; }
        public int OverloadedCount { get; set; }
        public int UnderloadedCount { get; set; }
        public int NoActivityCount { get; set; }
    }

    public class ReportsVm
    {
        public ReportPeriodVm Daily { get; set; } = new();
        public WeeklyReportVm Weekly { get; set; } = new();
        public MonthlyReportVm Monthly { get; set; } = new();
        public PerformanceReportVm Performance { get; set; } = new();
        public OverdueReportVm Overdue { get; set; } = new();
        public OvertimeReportVm Overtime { get; set; } = new();
        public BonusReportVm Bonus { get; set; } = new();
    }

    public class ReportPeriodVm
    {
        public decimal TotalHours { get; set; }
        public int CompletedTasks { get; set; }
        public decimal Overtime { get; set; }
        public List<ReportEntryVm> Entries { get; set; } = new();
    }

    public class WeeklyReportVm : ReportPeriodVm
    {
        public List<ChartItemVm> ByDays { get; set; } = new();
        public List<ChartItemVm> ByProjects { get; set; } = new();
    }

    public class MonthlyReportVm : ReportPeriodVm
    {
        public List<ChartItemVm> ByProjects { get; set; } = new();
        public List<ChartItemVm> ByWeeks { get; set; } = new();
    }

    public class PerformanceReportVm
    {
        public int Efficiency { get; set; }
        public int OverdueCount { get; set; }
        public decimal Overtime { get; set; }
        public decimal PlannedHours { get; set; }
        public decimal ActualHours { get; set; }
        public int NewCount { get; set; }
        public int ProgressCount { get; set; }
        public int ReviewCount { get; set; }
        public int DoneCount { get; set; }
    }

    public class OverdueReportVm
    {
        public int Count { get; set; }
        public int AverageDelay { get; set; }
        public int Assignees { get; set; }
        public List<OverdueTaskVm> Items { get; set; } = new();
    }

    public class OvertimeReportVm
    {
        public decimal Total { get; set; }
        public decimal MaxDay { get; set; }
        public int DaysCount { get; set; }
        public List<ChartItemVm> ByDays { get; set; } = new();
    }

    public class BonusReportVm
    {
        public int Percent { get; set; }
        public decimal Amount { get; set; }
        public string Reason { get; set; } = "";
    }

    public class ReportEntryVm
    {
        public int? TaskId { get; set; }
        public string Date { get; set; } = "";
        public string Task { get; set; } = "";
        public string Project { get; set; } = "";
        public decimal Hours { get; set; }
        public string Comment { get; set; } = "";
        public string Status { get; set; } = "";
        public string Assignee { get; set; } = "";
        public string Deadline { get; set; } = "";
    }

    public class OverdueTaskVm
    {
        public string Name { get; set; } = "";
        public string Project { get; set; } = "";
        public string Assignee { get; set; } = "";
        public string Deadline { get; set; } = "";
        public int DelayDays { get; set; }
    }

    public class ChartItemVm
    {
        public string Label { get; set; } = "";
        public decimal Value { get; set; }
    }

    public class TaskVm
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public string Project { get; set; } = "";
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public string Assignee { get; set; } = "";
        public string Priority { get; set; } = "medium";
        public string Status { get; set; } = "new";
        public decimal PlannedTime { get; set; }
        public string Deadline { get; set; } = "";
        public string DeadlineRaw { get; set; } = "";
        public string StageName { get; set; } = "";
    }

    public class ProjectVm
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TasksCount { get; set; }
        public int Progress { get; set; }

        public int? ManagerId { get; set; }
        public string ManagerName { get; set; } = "";

        public List<int> MemberIds { get; set; } = new();
        public int MembersCount { get; set; }

        public string? ProjectType { get; set; }
        public string ProjectTypeName { get; set; } = "Проект";
        public List<string> StageNames { get; set; } = new();
    }

    public class ActivityVm
    {
        public string Date { get; set; } = "";
        public string Task { get; set; } = "";
        public decimal Hours { get; set; }
        public string Comment { get; set; } = "";
    }

    public class ManualTimeRequestVm
    {
        public int Id { get; set; }
        public string Employee { get; set; } = "";
        public int UserId { get; set; }
        public int TaskId { get; set; }
        public string TaskName { get; set; } = "";
        public string ProjectName { get; set; } = "";
        public string WorkDate { get; set; } = "";
        public string? WorkDateValue { get; set; }
        public decimal Hours { get; set; }
        public string Reason { get; set; } = "";
        public string Comment { get; set; } = "";
        public string Status { get; set; } = "";
        public string CreatedAt { get; set; } = "";
        public string ReviewedAt { get; set; } = "";
        public string? ManagerComment { get; set; }
        public string? AttachmentPath { get; set; }
        public string? AttachmentName { get; set; }
        public bool CanResubmit { get; set; }
    }


    public class AddTaskDto
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public string Priority { get; set; } = "medium";
        public string Status { get; set; } = "new";
        public decimal PlannedTime { get; set; }
        public DateTime? Deadline { get; set; }
        public string? StageName { get; set; }
    }


    public class UpdateTaskDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public string Priority { get; set; } = "medium";
        public string Status { get; set; } = "new";
        public decimal PlannedTime { get; set; }
        public DateTime? Deadline { get; set; }
        public string? StageName { get; set; }
    }

    public class DeleteTaskDto
    {
        public int Id { get; set; }
    }

    public class AddProjectDto
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int? ManagerId { get; set; }
        public List<int>? MemberIds { get; set; }
        public string? ProjectType { get; set; }
        public List<string>? StageNames { get; set; }
    }

    public class DeleteProjectDto
    {
        public int Id { get; set; }
    }
    public class UpdateProjectDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int? ManagerId { get; set; }
        public List<int>? MemberIds { get; set; }
        public string? ProjectType { get; set; }
        public List<string>? StageNames { get; set; }
    }

    public class StartTaskTimerDto
    {
        public int TaskId { get; set; }
        public string? Comment { get; set; }
    }

    public class AddManualTimeDto
    {
        public int RequestId { get; set; }
        public int TaskId { get; set; }
        public decimal Hours { get; set; }
        public string? WorkDate { get; set; }
        public string? Reason { get; set; }
        public string? Comment { get; set; }
        public string? AttachmentPath { get; set; }
        public string? AttachmentName { get; set; }
    }

    public class ApproveManualTimeDto
    {
        public int Id { get; set; }
        public string? ManagerComment { get; set; }
    }

    public class RejectManualTimeDto
    {
        public int Id { get; set; }
        public string? ManagerComment { get; set; }
    }

    public class NeedsRevisionManualTimeDto
    {
        public int Id { get; set; }
        public string? ManagerComment { get; set; }
    }

    public class ServiceResult
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }

        public static ServiceResult Success() => new() { Ok = true };
        public static ServiceResult Fail(string error) => new() { Ok = false, Error = error };
    }

    public class ServiceResult<T>
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
        public T? Data { get; set; }

        public static ServiceResult<T> Success(T data) => new() { Ok = true, Data = data };
        public static ServiceResult<T> Fail(string error) => new() { Ok = false, Error = error };
    }

    public class UserVm
    {
        public int Id { get; set; }
        public string FullName { get; set; } = "";
        public string Login { get; set; } = "";
        public string Position { get; set; } = "";
        public string Role { get; set; } = "employee";
        public decimal HourlyRate { get; set; }
        public string Status { get; set; } = "active";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public int TasksInProgress { get; set; }
        public int CompletedTasks { get; set; }
        public int OverdueTasks { get; set; }
        public decimal TotalHours { get; set; }
        public decimal PlannedHours { get; set; }


        public string WorkMode { get; set; } = "fixed";
        public decimal RequiredDailyHours { get; set; }
        public string PlannedStartTime { get; set; } = "";
        public string PlannedEndTime { get; set; } = "";
        public decimal  WorkDayHours { get; set; }
        public decimal TrackedHours { get; set; }
        public decimal IdleHours { get; set; }
        public decimal SalaryHours { get; set; }

          public decimal WorkloadDiff { get; set; }
          public decimal CompletionPercent { get; set; }
          public string ProductivityState { get; set; } = "normal";
          public int BonusPercent { get; set; }
          public string BonusReason { get; set; } = "";
          public decimal BonusAmount { get; set; }


    }

    public class AddUserDto
    {
        public string LastName { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string? MiddleName { get; set; }
        public string Login { get; set; } = "";
        public string Password { get; set; } = "";
        public string Position { get; set; } = "";
        public decimal Rate { get; set; }
        public string Role { get; set; } = "employee";
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string Status { get; set; } = "active";


        public string WorkMode { get; set; } = "fixed";
        public decimal RequiredDailyHours { get; set; } = 8;
        public string? PlannedStartTime { get; set; }
        public string? PlannedEndTime { get; set; }
    }

    public class UpdateUserDto
    {
        public int Id { get; set; }
        public string LastName { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string? MiddleName { get; set; }
        public string Login { get; set; } = "";
        public string? Password { get; set; }
        public string Position { get; set; } = "";
        public decimal Rate { get; set; }
        public string Role { get; set; } = "employee";
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string Status { get; set; } = "active";


        public string WorkMode { get; set; } = "fixed";
        public decimal RequiredDailyHours { get; set; } = 8;
        public string? PlannedStartTime { get; set; }
        public string? PlannedEndTime { get; set; }
    }

    public class ToggleUserStatusDto
    {
        public int Id { get; set; }
    }



}
