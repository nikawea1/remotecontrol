using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Globalization;
using System.Text.Json;

namespace RemoteControl1.Services
{
    public class TrackerService
    {
        private readonly AppDbContext _db;
        private const string ManualRequestMetaPrefix = "__RCMT__";

        public TrackerService(AppDbContext db)
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

        private static string BuildFullName(string? lastName, string? firstName, string? middleName)
        {
            return string.Join(" ", new[] { lastName, firstName, middleName }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }
    }
}