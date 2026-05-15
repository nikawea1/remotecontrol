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
        private readonly ProjectService _projectService;
        private readonly UserService _userService;
        private readonly ProfileService _profileService;
        private readonly TrackerService _trackerService;
        private readonly ReportService _reportService;
        private readonly DashboardService _dashboardService;
        private const string ManualRequestMetaPrefix = "__RCMT__";


        public TaskService(
            AppDbContext db,
            ProjectService projectService,
            UserService userService,
            ProfileService profileService,
            TrackerService trackerService,
            ReportService reportService,
            DashboardService dashboardService)
        {
            _db = db;
            _projectService = projectService;
            _userService = userService;
            _profileService = profileService;
            _trackerService = trackerService;
            _reportService = reportService;
            _dashboardService = dashboardService;
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
            return await _dashboardService.GetPageDataAsync(userId);
        }
        public async Task<ServiceResult<ReportDataVm>> GetReportDataAsync(int userId, string? dateFrom, string? dateTo, int? projectId)
        {
            return await _reportService.GetReportDataAsync(userId, dateFrom, dateTo, projectId);
        }

        public async Task<AdminAnalyticsVm> GetAdminAnalyticsAsync(int currentUserId, string currentUserRole)
        {
            return await _reportService.GetAdminAnalyticsAsync(currentUserId, currentUserRole);
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
            return await _reportService.GetReportsDataAsync(
                currentUserId,
                currentUserRole,
                isAdmin,
                dateFrom,
                dateTo,
                projectId,
                employeeId);
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

            var deadline = dto.Deadline ?? DateTime.Today.AddDays(7);

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
                Deadline = deadline,
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

        public async Task<ServiceResult<TaskVm>> SubmitTaskForReviewAsync(int currentUserId, SubmitTaskForReviewDto dto)
        {
            if (dto.Id <= 0)
                return ServiceResult<TaskVm>.Fail("Задача не найдена");

            if (string.IsNullOrWhiteSpace(dto.Description))
                return ServiceResult<TaskVm>.Fail("Добавьте отчёт перед отправкой на проверку");

            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);
            if (currentUser == null)
                return ServiceResult<TaskVm>.Fail("Пользователь не найден");

            var task = await _db.Tasks
                .Include(t => t.Project)
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == dto.Id);

            if (task == null)
                return ServiceResult<TaskVm>.Fail("Задача не найдена");

            if (task.UserId != currentUserId)
                return ServiceResult<TaskVm>.Fail("Нет прав на отправку этой задачи");

            task.Description = dto.Description.Trim();
            task.Status = "review";

            await _db.SaveChangesAsync();

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

            var relatedManualRequests = await _db.ManualTimeRequests
                .Where(x => x.TaskItemId == taskId)
                .ToListAsync();

            if (relatedManualRequests.Count > 0)
                _db.ManualTimeRequests.RemoveRange(relatedManualRequests);

            var relatedActivityLogs = await _db.ActivityLogs
                .Where(x => x.TaskItemId == taskId)
                .ToListAsync();

            if (relatedActivityLogs.Count > 0)
                _db.ActivityLogs.RemoveRange(relatedActivityLogs);

            _db.Tasks.Remove(task);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> DeleteProjectAsync(int currentUserId, int projectId)
        {
            return await _projectService.DeleteProjectAsync(currentUserId, projectId);
        }

        public async Task<ServiceResult<ProjectVm>> AddProjectAsync(int userId, AddProjectDto dto)
        {
            return await _projectService.AddProjectAsync(userId, dto);
        }

        public async Task<ServiceResult<ProjectVm>> UpdateProjectAsync(int currentUserId, UpdateProjectDto dto)
        {
            return await _projectService.UpdateProjectAsync(currentUserId, dto);
        }



        public async Task<ServiceResult> StartWorkDayAsync(int userId)
        {
            return await _trackerService.StartWorkDayAsync(userId);
        }

        public async Task<ServiceResult<decimal>> StopWorkDayAsync(int userId)
        {
            return await _trackerService.StopWorkDayAsync(userId);
        }


        public async Task<ServiceResult> StartTaskTimerAsync(int userId, StartTaskTimerDto dto)
        {
            return await _trackerService.StartTaskTimerAsync(userId, dto);
        }
        public async Task<ServiceResult<decimal>> PauseTaskTimerAsync(int userId)
        {
            return await _trackerService.PauseTaskTimerAsync(userId);
        }
        public async Task<ServiceResult<decimal>> StopTaskTimerAsync(int userId)
        {
            return await _trackerService.StopTaskTimerAsync(userId);
        }
        public async Task<ServiceResult<ActivityVm>> AddManualTimeAsync(int userId, AddManualTimeDto dto)
        {
            return await _trackerService.AddManualTimeAsync(userId, dto);
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
            return await _trackerService.CreateManualTimeRequestAsync(userId, dto);
        }
        public async Task<ServiceResult<ManualTimeRequestVm>> UpdateManualTimeRequestAsync(int userId, AddManualTimeDto dto)
        {
            return await _trackerService.UpdateManualTimeRequestAsync(userId, dto);
        }
        public async Task<List<ManualTimeRequestVm>> GetManualTimeRequestsAsync(int currentUserId, string currentUserRole)
        {
            return await _trackerService.GetManualTimeRequestsAsync(currentUserId, currentUserRole);
        }
        public async Task<ServiceResult> ApproveManualTimeRequestAsync(int currentUserId, string currentUserRole, ApproveManualTimeDto dto)
        {
            return await _trackerService.ApproveManualTimeRequestAsync(currentUserId, currentUserRole, dto);
        }
        public async Task<ServiceResult> ReturnManualTimeRequestForRevisionAsync(int currentUserId, string currentUserRole, NeedsRevisionManualTimeDto dto)
        {
            return await _trackerService.ReturnManualTimeRequestForRevisionAsync(currentUserId, currentUserRole, dto);
        }
        public async Task<ServiceResult> RejectManualTimeRequestAsync(int currentUserId, string currentUserRole, RejectManualTimeDto dto)
        {
            return await _trackerService.RejectManualTimeRequestAsync(currentUserId, currentUserRole, dto);
        }
        public async Task<ServiceResult> ChangePasswordAsync(int userId, string oldPassword, string newPassword)
        {
            return await _profileService.ChangePasswordAsync(userId, oldPassword, newPassword);
        }

        public async Task<ServiceResult<UserVm>> AddUserAsync(AddUserDto dto)
        {
            return await _userService.AddUserAsync(dto);
        }

        public async Task<ServiceResult<UserVm>> UpdateUserAsync(UpdateUserDto dto)
        {
            return await _userService.UpdateUserAsync(dto);
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
            return await _userService.ToggleUserStatusAsync(id);
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

        private static string HashPassword(string value)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            return Convert.ToHexString(
                sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))
            );
        }




        public async Task<object?> GetCurrentWorkDayStatusAsync(int userId)
        {
            return await _trackerService.GetCurrentWorkDayStatusAsync(userId);
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
        public int ProgressPercent { get; set; }
        public int StageProgressPercent { get; set; }
        public Dictionary<string, int> StageProgressPercents { get; set; } = new();
        public string CurrentStage { get; set; } = "";
        public string NextStage { get; set; } = "";

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

    public class SubmitTaskForReviewDto
    {
        public int Id { get; set; }
        public string? Description { get; set; }
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
