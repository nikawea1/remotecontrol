using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Text.Json;

namespace RemoteControl1.Services
{
    public class TaskService
    {
        private readonly AppDbContext _db;


        public TaskService(AppDbContext db)
        {
            _db = db;
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

                visibleUsers = allUsers
               .Where(u =>
                   u.IsActive &&
                   (u.Role == "employee" || u.Role == "manager") &&
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
                    a.ActivityType != "workday" &&
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
                .Where(a => a.UserId == userId && a.ActivityType != "workday");

            if (from.HasValue)
                logsQuery = logsQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) >= from.Value);

            if (to.HasValue)
                logsQuery = logsQuery.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) <= to.Value);

            if (projectId.HasValue)
                logsQuery = logsQuery.Where(a => a.ProjectId == projectId.Value);

            var logs = await logsQuery
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToListAsync();

            var tasksQuery = _db.Tasks
                .Include(t => t.Project)
                .Where(t => t.UserId == userId);

            if (projectId.HasValue)
                tasksQuery = tasksQuery.Where(t => t.ProjectId == projectId.Value);

            var tasks = await tasksQuery.ToListAsync();

            var totalHours = Math.Round(logs.Sum(x => x.DurationHours), 2);

            var completedTasks = tasks.Count(t => (t.Status ?? "") == "done");

            var overdueTasks = tasks
                .Where(t => t.Deadline.HasValue &&
                            t.Deadline.Value.Date < DateTime.Today &&
                            (t.Status ?? "") != "done")
                .Select(t => new OverdueTaskVm
                {
                    Name = t.Title,
                    Project = t.Project?.Name ?? "Без проекта",
                    Assignee = t.Assignee ?? "",
                    Deadline = t.Deadline.HasValue ? t.Deadline.Value.ToString("dd.MM.yyyy") : "",
                    DelayDays = t.Deadline.HasValue
                        ? Math.Max(0, (DateTime.Today - t.Deadline.Value.Date).Days)
                        : 0
                })
                .OrderByDescending(x => x.DelayDays)
                .ToList();

            var byProjects = logs
                .GroupBy(x => x.TaskItem?.Project?.Name ?? "Без проекта")
                .Select(g => new ChartItemVm
                {
                    Label = g.Key,
                    Value = Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderByDescending(x => x.Value)
                .ToList();

            var byDays = logs
           .GroupBy(x => (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().Date)
           .Select(g => new ChartItemVm
           {
               Label = g.Key.ToString("dd.MM"),
               Value = Math.Round(g.Sum(x => x.DurationHours), 2)
           })
           .OrderBy(x => DateTime.ParseExact(x.Label, "dd.MM", null))
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

            var plannedHours = Math.Round(tasks.Sum(t => t.PlannedTimeHours), 2);
            var actualHours = totalHours;

            var doneCount = tasks.Count(t => (t.Status ?? "") == "done");
            var allCount = tasks.Count;

            var completionRate = allCount > 0
                ? Math.Round((double)doneCount / allCount * 100, 0)
                : 0;

            var hoursRate = plannedHours > 0
                ? Math.Min(100, Math.Round(actualHours / plannedHours * 100, 0))
                : 0;

            var efficiency = (int)Math.Round((completionRate + hoursRate) / 2.0, 0);

            var bonusPercent = 0;
            var bonusReason = "Нет";

            if (efficiency >= 85 && overdueTasks.Count == 0)
            {
                bonusPercent = 15;
                bonusReason = "Высокая эффективность";
            }
            else if (efficiency >= 70)
            {
                bonusPercent = 10;
                bonusReason = "Хорошие показатели";
            }
            else if (efficiency >= 50)
            {
                bonusPercent = 5;
                bonusReason = "Базовый бонус";
            }

            var bonusAmount = Math.Round((decimal)actualHours * user.HourlyRate * bonusPercent / 100, 2);

            var result = new ReportDataVm
            {
                UserName = string.Join(" ", new[] { user.LastName, user.FirstName, user.MiddleName }
                    .Where(x => !string.IsNullOrWhiteSpace(x))),
                TotalHours = (decimal)totalHours,
                CompletedTasks = completedTasks,
                OvertimeHours = Math.Max(0m, (decimal)totalHours - (decimal)plannedHours),
                PlannedHours = (decimal)plannedHours,
                ActualHours = (decimal)actualHours,
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
        public async Task<AdminAnalyticsVm> GetAdminAnalyticsAsync()
        {
            var users = await _db.Users
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

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
                OverloadedCount = userItems.Count(x =>
                 x.TasksInProgress >= 5 ||
                 (x.PlannedHours > 0 && x.TrackedHours > (decimal)x.PlannedHours * 1.1m)),
                UnderloadedCount = userItems.Count(x =>
                    x.PlannedHours > 0 && x.TrackedHours < (decimal)x.PlannedHours * 0.6m),
                NoActivityCount = userItems.Count(x => x.TrackedHours <= 0)
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
                .Where(a => a.ActivityType != "workday")
                .ToListAsync();

            var range = BuildDateRange(dateFrom, dateTo);

            IEnumerable<TaskItem> tasksQuery = allTasks;
            IEnumerable<ActivityLog> logsQuery = allLogs;

            if (!isAdmin && currentRole == "employee")
            {
                tasksQuery = tasksQuery.Where(t => t.UserId == currentUserId);
                logsQuery = logsQuery.Where(a => a.UserId == currentUserId);
            }
            else if (!isAdmin && currentRole == "manager")
            {
                var managerProjectIds = allTasks
                    .Where(t => t.Project != null && t.Project.ManagerId == currentUserId)
                    .Select(t => t.ProjectId)
                    .Distinct()
                    .ToList();

                tasksQuery = tasksQuery.Where(t => managerProjectIds.Contains(t.ProjectId));
                logsQuery = logsQuery.Where(a => a.ProjectId.HasValue && managerProjectIds.Contains(a.ProjectId.Value));
            }

            if (employeeId.HasValue)
            {
                if (isAdmin)
                {
                    tasksQuery = tasksQuery.Where(t => t.UserId == employeeId.Value);
                    logsQuery = logsQuery.Where(a => a.UserId == employeeId.Value);
                }
                else if (currentRole == "manager")
                {
                    var managerProjectIds = allTasks
                        .Where(t => t.Project != null && t.Project.ManagerId == currentUserId)
                        .Select(t => t.ProjectId)
                        .Distinct()
                        .ToList();

                    var allowedUserIds = await _db.ProjectMembers
    .Where(x => managerProjectIds.Contains(x.ProjectId))
    .Select(x => x.UserId)
    .Distinct()
    .ToListAsync();

                    if (allowedUserIds.Contains(employeeId.Value))
                    {
                        tasksQuery = tasksQuery.Where(t => t.UserId == employeeId.Value);
                        logsQuery = logsQuery.Where(a => a.UserId == employeeId.Value);
                    }
                    else
                    {
                        tasksQuery = Enumerable.Empty<TaskItem>();
                        logsQuery = Enumerable.Empty<ActivityLog>();
                    }
                }
            }

            if (projectId.HasValue)
            {
                tasksQuery = tasksQuery.Where(t => t.ProjectId == projectId.Value);
                logsQuery = logsQuery.Where(a => a.ProjectId == projectId.Value);
            }

            logsQuery = logsQuery.Where(a =>
            {
                var d = a.EndedAtUtc ?? a.StartedAtUtc;
                return d >= range.From && d <= range.To;
            });

            var scopedTasks = tasksQuery.ToList();
            var scopedLogs = logsQuery
                .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
                .ToList();

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

            var overdueItems = BuildOverdueItems(scopedTasks);
            var selectedUser = employeeId.HasValue
                ? allUsers.FirstOrDefault(x => x.Id == employeeId.Value)
                : currentUser;

            var dailyHours = SumHours(dayLogs);
            var weeklyHours = SumHours(weekLogs);
            var monthlyHours = SumHours(scopedLogs);

            var dailyOvertime = CalculateOvertime(dayLogs);
            var weeklyOvertime = CalculateOvertime(weekLogs);
            var monthlyOvertime = CalculateOvertime(scopedLogs);

            var dailyCompleted = CountCompletedWorkedTasks(dayLogs, scopedTasks);
            var weeklyCompleted = CountCompletedWorkedTasks(weekLogs, scopedTasks);
            var monthlyCompleted = CountCompletedWorkedTasks(scopedLogs, scopedTasks);

            var plannedHours = scopedTasks.Sum(t => t.PlannedTimeHours);
            var actualHours = monthlyHours;

            var doneCount = scopedTasks.Count(t => (t.Status ?? "") == "done");
            var allCount = scopedTasks.Count;
            var completionRate = allCount > 0
                ? (int)Math.Round((double)doneCount / allCount * 100)
                : 0;
            var hourRate = plannedHours > 0
                ? Math.Min(100, (int)Math.Round(actualHours / plannedHours * 100))
                : 0;
            var efficiency = (int)Math.Round((completionRate + hourRate) / 2.0);

            var bonusPercent = 0;
            var bonusReason = "Нет";

            if (efficiency >= 85 && overdueItems.Count == 0)
            {
                bonusPercent = 15;
                bonusReason = "Высокая эффективность";
            }
            else if (efficiency >= 70)
            {
                bonusPercent = 10;
                bonusReason = "Хорошие показатели";
            }
            else if (efficiency >= 50)
            {
                bonusPercent = 5;
                bonusReason = "Базовый бонус";
            }

            var rate = selectedUser?.HourlyRate ?? 0;
            var bonusAmount = Math.Round((decimal)actualHours * rate * bonusPercent / 100m, 0);

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
                    OverdueCount = overdueItems.Count,
                    Overtime = monthlyOvertime,
                    PlannedHours = plannedHours,
                    ActualHours = actualHours,
                    NewCount = scopedTasks.Count(t => (t.Status ?? "") == "new"),
                    ProgressCount = scopedTasks.Count(t => (t.Status ?? "") == "progress"),
                    ReviewCount = scopedTasks.Count(t => (t.Status ?? "") == "review"),
                    DoneCount = scopedTasks.Count(t => (t.Status ?? "") == "done")
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
                    MaxDay = GetMaxOvertimeDay(scopedLogs),
                    DaysCount = GetOvertimeDays(scopedLogs).Count,
                    ByDays = GetOvertimeDays(scopedLogs)
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

            var task = new TaskItem
            {
                Title = dto.Name.Trim(),
                Description = dto.Description?.Trim() ?? "",
                ProjectId = dto.ProjectId,
                UserId = performerId,
                Assignee = BuildFullName(performer.LastName, performer.FirstName, performer.MiddleName),
                Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "medium" : dto.Priority,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "new" : dto.Status,
                PlannedTimeHours = dto.PlannedTime,
                Deadline = dto.Deadline,
                StageName = dto.StageName?.Trim() ?? ""
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

            if (string.IsNullOrWhiteSpace(dto.Name))
                return ServiceResult<TaskVm>.Fail("Введите название задачи");

            var project = await _db.Projects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId);

            if (project == null)
                return ServiceResult<TaskVm>.Fail("Проект не найден");

            if (role == "employee" && task.UserId != currentUserId)
                return ServiceResult<TaskVm>.Fail("Нет прав");

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

            task.Title = dto.Name.Trim();
            task.Description = dto.Description?.Trim() ?? "";
            task.Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "medium" : dto.Priority;
            task.Status = string.IsNullOrWhiteSpace(dto.Status) ? "new" : dto.Status;
            task.ProjectId = dto.ProjectId;
            task.UserId = performerId;
            task.Assignee = BuildFullName(performer.LastName, performer.FirstName, performer.MiddleName);
            task.PlannedTimeHours = dto.PlannedTime;
            task.Deadline = dto.Deadline;
            task.StageName = dto.StageName?.Trim() ?? "";

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
                DurationHours = 0,
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


        public async Task<ServiceResult<double>> StopWorkDayAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<double>.Fail("Пользователь не найден");

            var activeDay = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "workday" &&
                a.IsActive);

            if (activeDay == null)
                return ServiceResult<double>.Fail("Рабочий день не найден");

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
                timer.DurationHours = Math.Round(
                    (timer.EndedAtUtc.Value - timer.StartedAtUtc).TotalHours, 2);
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

            var idleHours = totalDayHours - trackedHours;
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
            activeDay.DurationHours = Math.Round((double)totalDayHours, 2);

            activeDay.PlannedHours = plannedHours;
            activeDay.TrackedHours = trackedHours;
            activeDay.IdleHours = idleHours;
            activeDay.OvertimeHours = overtimeHours;
            activeDay.UnderworkHours = underworkHours;

            user.IsWorking = false;
            user.WorkStartUtc = null;

            await _db.SaveChangesAsync();

            return ServiceResult<double>.Success(activeDay.DurationHours);
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
                DurationHours = 0,
                Comment = dto.Comment?.Trim(),
                IsIdle = false
            };

            _db.ActivityLogs.Add(log);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult<double>> PauseTaskTimerAsync(int userId)
        {
            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer == null)
                return ServiceResult<double>.Fail("Активный таймер не найден");

            activeTimer.EndedAtUtc = DateTime.UtcNow;
            activeTimer.IsActive = false;
            activeTimer.DurationHours = Math.Round(
                (activeTimer.EndedAtUtc.Value - activeTimer.StartedAtUtc).TotalHours, 2);

            await _db.SaveChangesAsync();

            return ServiceResult<double>.Success(activeTimer.DurationHours);
        }

        public async Task<ServiceResult<double>> StopTaskTimerAsync(int userId)
        {
            var activeTimer = await _db.ActivityLogs.FirstOrDefaultAsync(a =>
                a.UserId == userId &&
                a.ActivityType == "task_timer" &&
                a.IsActive);

            if (activeTimer == null)
                return ServiceResult<double>.Fail("Активный таймер не найден");

            activeTimer.EndedAtUtc = DateTime.UtcNow;
            activeTimer.IsActive = false;
            activeTimer.DurationHours = Math.Round(
                (activeTimer.EndedAtUtc.Value - activeTimer.StartedAtUtc).TotalHours, 2);

            await _db.SaveChangesAsync();

            return ServiceResult<double>.Success(activeTimer.DurationHours);
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
                StartedAtUtc = now.AddHours(-dto.Hours),
                EndedAtUtc = now,
                DurationHours = dto.Hours,
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

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<ManualTimeRequestVm>.Fail("Пользователь не найден");

            var request = new ManualTimeRequest
            {
                UserId = userId,
                TaskItemId = task.Id,
                ProjectId = task.ProjectId,
                Hours = dto.Hours,
                Comment = dto.Comment?.Trim() ?? "",
                Status = "pending",
                CreatedAtUtc = DateTime.UtcNow,
                AttachmentPath = dto.AttachmentPath,
                AttachmentName = dto.AttachmentName
            };

            _db.ManualTimeRequests.Add(request);
            await _db.SaveChangesAsync();

            return ServiceResult<ManualTimeRequestVm>.Success(new ManualTimeRequestVm
            {
                Id = request.Id,
                Employee = BuildFullName(user.LastName, user.FirstName, user.MiddleName),
                UserId = userId,
                TaskId = task.Id,
                TaskName = task.Title,
                ProjectName = task.Project?.Name ?? "Без проекта",
                Hours = request.Hours,
                Comment = request.Comment,
                Status = request.Status,
                CreatedAt = request.CreatedAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                ManagerComment = request.ManagerComment,
                AttachmentPath = request.AttachmentPath,
                AttachmentName = request.AttachmentName
            });
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

                query = query.Where(x => managerProjectIds.Contains(x.ProjectId))
                             .OrderByDescending(x => x.CreatedAtUtc);
            }
            else if (role == "employee")
            {
                query = query.Where(x => x.UserId == currentUserId)
                             .OrderByDescending(x => x.CreatedAtUtc);
            }

            var list = await query.ToListAsync();

            return list.Select(x => new ManualTimeRequestVm
            {
                Id = x.Id,
                Employee = x.User == null ? "" : BuildFullName(x.User.LastName, x.User.FirstName, x.User.MiddleName),
                UserId = x.UserId,
                TaskId = x.TaskItemId,
                TaskName = x.TaskItem?.Title ?? "Без задачи",
                ProjectName = x.TaskItem?.Project?.Name ?? "Без проекта",
                Hours = x.Hours,
                Comment = x.Comment ?? "",
                Status = x.Status,
                CreatedAt = x.CreatedAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                ManagerComment = x.ManagerComment,
                AttachmentPath = x.AttachmentPath,
                AttachmentName = x.AttachmentName
            }).ToList();
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

            var now = DateTime.UtcNow;

            var log = new ActivityLog
            {
                UserId = request.UserId,
                TaskItemId = request.TaskItemId,
                ProjectId = request.ProjectId,
                ActivityType = "manual_time",
                StartedAtUtc = now.AddHours(-request.Hours),
                EndedAtUtc = now,
                DurationHours = request.Hours,
                Comment = string.IsNullOrWhiteSpace(request.Comment)
                    ? "Ручное время одобрено менеджером"
                    : request.Comment,
                IsActive = false,
                IsIdle = false
            };

            _db.ActivityLogs.Add(log);
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

            request.Status = "rejected";
            request.ManagerComment = dto.ManagerComment?.Trim();
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

            return ServiceResult<UserVm>.Success(new UserVm
            {
                Id = user.Id,
                FullName = BuildFullName(user.LastName, user.FirstName, user.MiddleName),
                Login = user.Login ?? "",
                Email = user.Email ?? "",
                Position = user.Position ?? "",
                Role = user.Role ?? "employee",
                HourlyRate = user.HourlyRate,
                Status = user.IsActive ? "active" : "blocked",
                Phone = user.Phone ?? "",
                TasksInProgress = 0,
                CompletedTasks = 0,
                OverdueTasks = 0,
                TotalHours = 0,
                PlannedHours = 0
            });
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

            var userTasks = await _db.Tasks.Where(t => t.UserId == user.Id).ToListAsync();
            var totalHours = await _db.ActivityLogs
                .Where(a => a.UserId == user.Id && a.ActivityType != "workday")
                .SumAsync(a => (double?)a.DurationHours) ?? 0;

            return ServiceResult<UserVm>.Success(new UserVm
            {
                Id = user.Id,
                FullName = BuildFullName(user.LastName, user.FirstName, user.MiddleName),
                Login = user.Login ?? "",
                Email = user.Email ?? "",
                Position = user.Position ?? "",
                Role = user.Role ?? "employee",
                HourlyRate = user.HourlyRate,
                Status = user.IsActive ? "active" : "blocked",
                Phone = user.Phone ?? "",
                TasksInProgress = userTasks.Count(t => (t.Status ?? "") == "progress"),
                CompletedTasks = userTasks.Count(t => (t.Status ?? "") == "done"),
                OverdueTasks = userTasks.Count(t =>
                    t.Deadline.HasValue &&
                    t.Deadline.Value.Date < DateTime.Today &&
                    (t.Status ?? "") != "done"),
                TotalHours = Math.Round(totalHours, 1),
                PlannedHours = Math.Round(userTasks.Sum(t => t.PlannedTimeHours), 1)
            });
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

            var userTasks = await _db.Tasks.Where(t => t.UserId == user.Id).ToListAsync();
            var totalHours = await _db.ActivityLogs
                .Where(a => a.UserId == user.Id && a.ActivityType != "workday")
                .SumAsync(a => (double?)a.DurationHours) ?? 0;

            return ServiceResult<UserVm>.Success(new UserVm
            {
                Id = user.Id,
                FullName = BuildFullName(user.LastName, user.FirstName, user.MiddleName),
                Login = user.Login ?? "",
                Email = user.Email ?? "",
                Position = user.Position ?? "",
                Role = user.Role ?? "employee",
                HourlyRate = user.HourlyRate,
                Status = user.IsActive ? "active" : "blocked",
                Phone = user.Phone ?? "",
                TasksInProgress = userTasks.Count(t => (t.Status ?? "") == "progress"),
                CompletedTasks = userTasks.Count(t => (t.Status ?? "") == "done"),
                OverdueTasks = userTasks.Count(t =>
                    t.Deadline.HasValue &&
                    t.Deadline.Value.Date < DateTime.Today &&
                    (t.Status ?? "") != "done"),
                TotalHours = Math.Round(totalHours, 1),
                PlannedHours = Math.Round(userTasks.Sum(t => t.PlannedTimeHours), 1)
            });
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

            int progress = 0;

            if (stageNames.Count > 0)
            {
                var stagePercents = new List<int>();

                foreach (var stageName in stageNames)
                {
                    var stageTasks = tasks
                        .Where(x => (x.StageName ?? "") == stageName)
                        .ToList();

                    if (stageTasks.Count == 0)
                    {
                        stagePercents.Add(0);
                        continue;
                    }

                    var stageDone = stageTasks.Count(x => x.Status == "done");
                    var stageProgress = (int)Math.Round(stageDone * 100.0 / stageTasks.Count);

                    stagePercents.Add(stageProgress);
                }

                progress = stagePercents.Count > 0
                    ? (int)Math.Round(stagePercents.Average())
                    : 0;
            }
            else
            {
                var tasksCount = tasks.Count;
                var doneCount = tasks.Count(x => x.Status == "done");
                progress = tasksCount == 0 ? 0 : (int)Math.Round(doneCount * 100.0 / tasksCount);
            }

            return new ProjectVm
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                TasksCount = tasks.Count,
                Progress = progress,
                ManagerId = p.ManagerId,
                ManagerName = p.Manager != null
                    ? BuildFullName(p.Manager.LastName, p.Manager.FirstName, p.Manager.MiddleName)
                    : "",
                MemberIds = memberIds,
                MembersCount = memberIds.Count,
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
                .Where(a => a.ActivityType == "workday")
                .ToList();

            var taskLogs = userLogs
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToList();

            var totalTrackedHours = Math.Round(taskLogs.Sum(a => a.DurationHours), 2);
            var totalPlannedHours = Math.Round(userTasks.Sum(t => t.PlannedTimeHours), 2);

            var workDayHours = Math.Round(workDayLogs.Sum(a => a.DurationHours), 2);
            var trackedHours = totalTrackedHours;
            var idleHours = Math.Round(workDayLogs.Sum(a => (double)a.IdleHours), 2);
            var salaryHours = trackedHours;

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
                TasksInProgress = userTasks.Count(t => (t.Status ?? "") == "progress"),
                CompletedTasks = userTasks.Count(t => (t.Status ?? "") == "done"),
                OverdueTasks = userTasks.Count(t =>
                    t.Deadline.HasValue &&
                    t.Deadline.Value.Date < DateTime.Today &&
                    (t.Status ?? "") != "done"),
                PlannedHours = totalPlannedHours,
                TotalHours = totalTrackedHours,

                WorkMode = u.WorkMode ?? "fixed",
                RequiredDailyHours = u.RequiredDailyHours,
                PlannedStartTime = u.PlannedStartTime?.ToString(@"hh\:mm") ?? "",
                PlannedEndTime = u.PlannedEndTime?.ToString(@"hh\:mm") ?? "",
                WorkDayHours = (decimal)workDayHours,
                TrackedHours = (decimal)trackedHours,
                IdleHours = (decimal)idleHours,
                SalaryHours = (decimal)salaryHours
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

        private static double SumHours(List<ActivityLog> logs)
        {
            return Math.Round(logs.Sum(x => x.DurationHours), 2);
        }

        private static double CalculateOvertime(List<ActivityLog> logs)
        {
            return Math.Round(GetOvertimeDays(logs).Sum(x => x.Value), 2);
        }

        private static List<ChartItemVm> GetOvertimeDays(List<ActivityLog> logs)
        {
            var result = logs
                .GroupBy(x => (x.EndedAtUtc ?? x.StartedAtUtc).ToLocalTime().Date)
                .Select(g =>
                {
                    var total = g.Sum(x => x.DurationHours);
                    var overtime = Math.Max(0, total - 8);

                    return new ChartItemVm
                    {
                        Label = g.Key.ToString("dd.MM.yyyy"),
                        Value = Math.Round(overtime, 2)
                    };
                })
                .Where(x => x.Value > 0)
                .OrderBy(x => x.Label)
                .ToList();

            return result;
        }

        private static double GetMaxOvertimeDay(List<ActivityLog> logs)
        {
            var days = GetOvertimeDays(logs);
            return days.Count > 0 ? days.Max(x => x.Value) : 0;
        }

        private static int CountCompletedWorkedTasks(List<ActivityLog> logs, List<TaskItem> tasks)
        {
            var taskNames = logs
                .Select(x => (x.TaskItem?.Title ?? "").Trim().ToLower())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            return tasks.Count(t =>
                (t.Status ?? "") == "done" &&
                taskNames.Contains((t.Title ?? "").Trim().ToLower()));
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
                    Value = Math.Round(g.Sum(x => x.DurationHours), 2)
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
                    Value = Math.Round(g.Sum(x => x.DurationHours), 2)
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
                    Value = Math.Round(g.Sum(x => x.DurationHours), 2)
                })
                .OrderBy(x => x.Label)
                .ToList();
        }

        private static List<OverdueTaskVm> BuildOverdueItems(List<TaskItem> tasks)
        {
            var today = DateTime.Today;

            return tasks
                .Where(t => t.Deadline.HasValue && (t.Status ?? "") != "done")
                .Select(t =>
                {
                    var delay = (today - t.Deadline!.Value.Date).Days;

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

            if (activeDay == null)
            {
                return new
                {
                    isWorking = false,
                    workMode = user.WorkMode,
                    requiredDailyHours = user.RequiredDailyHours,
                    plannedStartTime = user.PlannedStartTime?.ToString(@"hh\:mm"),
                    plannedEndTime = user.PlannedEndTime?.ToString(@"hh\:mm"),
                    startedAt = "",
                    currentHours = 0m,
                    trackedHours = 0m,
                    idleHours = 0m,
                    remainingHours = user.RequiredDailyHours > 0 ? user.RequiredDailyHours : 0m
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
                    tracked += (decimal)(now - item.StartedAtUtc).TotalHours;
                else
                    tracked += (decimal)item.DurationHours;
            }

            tracked += manualLogs.Sum(x => (decimal)x.DurationHours);
            tracked = Math.Round(tracked, 2);

            var idle = currentDayHours - tracked;
            if (idle < 0)
                idle = 0;

            var requiredDailyHours = user.RequiredDailyHours > 0 ? user.RequiredDailyHours : 8m;
            var remainingHours = requiredDailyHours - currentDayHours;
            if (remainingHours < 0)
                remainingHours = 0;

            return new
            {
                isWorking = true,
                startedAt = activeDay.StartedAtUtc.ToLocalTime().ToString("HH:mm"),
                currentHours = currentDayHours,
                trackedHours = tracked,
                idleHours = idle,
                remainingHours = remainingHours,
                workMode = user.WorkMode,
                requiredDailyHours = requiredDailyHours,
                plannedStartTime = user.PlannedStartTime?.ToString(@"hh\:mm"),
                plannedEndTime = user.PlannedEndTime?.ToString(@"hh\:mm")
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
        public double Hours { get; set; }
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
        public double TotalHours { get; set; }
        public int CompletedTasks { get; set; }
        public double Overtime { get; set; }
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
        public double Overtime { get; set; }
        public double PlannedHours { get; set; }
        public double ActualHours { get; set; }
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
        public double Total { get; set; }
        public double MaxDay { get; set; }
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
        public double Hours { get; set; }
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
        public double Value { get; set; }
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
        public double PlannedTime { get; set; }
        public string Deadline { get; set; } = "";
        public string DeadlineRaw { get; set; } = "";
        public string StageName { get; set; } = "";
    }

    public class ProjectVm
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int TasksCount { get; set; }
        public int Progress { get; set; }

        public int? ManagerId { get; set; }
        public string ManagerName { get; set; } = "";

        public List<int> MemberIds { get; set; } = new();
        public int MembersCount { get; set; }

        public string ProjectTypeName { get; set; } = "Проект";
        public List<string> StageNames { get; set; } = new();
    }

    public class ActivityVm
    {
        public string Date { get; set; } = "";
        public string Task { get; set; } = "";
        public double Hours { get; set; }
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
        public double Hours { get; set; }
        public string Comment { get; set; } = "";
        public string Status { get; set; } = "";
        public string CreatedAt { get; set; } = "";
        public string? ManagerComment { get; set; }
        public string? AttachmentPath { get; set; }
        public string? AttachmentName { get; set; }
    }


    public class AddTaskDto
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public string Priority { get; set; } = "medium";
        public string Status { get; set; } = "new";
        public double PlannedTime { get; set; }
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
        public double PlannedTime { get; set; }
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
        public int TaskId { get; set; }
        public double Hours { get; set; }
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
        public double TotalHours { get; set; }
        public double PlannedHours { get; set; }


        public string WorkMode { get; set; } = "fixed";
        public decimal RequiredDailyHours { get; set; }
        public string PlannedStartTime { get; set; } = "";
        public string PlannedEndTime { get; set; } = "";
        public decimal  WorkDayHours { get; set; }
        public decimal TrackedHours { get; set; }
        public decimal IdleHours { get; set; }
        public decimal SalaryHours { get; set; }
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