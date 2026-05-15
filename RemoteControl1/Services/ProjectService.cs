using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Text.Json;

namespace RemoteControl1.Services
{
    public class ProjectService
    {
        private readonly AppDbContext _db;

        public ProjectService(AppDbContext db)
        {
            _db = db;
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

            var loadedProject = await _db.Projects
                .Include(p => p.Manager)
                .Include(p => p.Members)
                .FirstAsync(p => p.Id == project.Id);

            return ServiceResult<ProjectVm>.Success(await BuildProjectVm(loadedProject));
        }

        public async Task<ServiceResult<ProjectVm>> UpdateProjectAsync(int currentUserId, UpdateProjectDto dto)
        {
            if (dto == null || dto.Id <= 0)
                return ServiceResult<ProjectVm>.Fail("Проект не найден");

            if (string.IsNullOrWhiteSpace(dto.Name))
                return ServiceResult<ProjectVm>.Fail("Введите название проекта");

            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == currentUserId);
            if (currentUser == null)
                return ServiceResult<ProjectVm>.Fail("Пользователь не найден");

            var role = (currentUser.Role ?? "").ToLower();
            if (role == "employee")
                return ServiceResult<ProjectVm>.Fail("Нет прав");

            var project = await _db.Projects
                .Include(p => p.Manager)
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == dto.Id);

            if (project == null)
                return ServiceResult<ProjectVm>.Fail("Проект не найден");

            if (role == "manager" && project.ManagerId != currentUserId)
                return ServiceResult<ProjectVm>.Fail("Нет прав на этот проект");

            int managerId;

            if (role == "admin")
            {
                if (!dto.ManagerId.HasValue || dto.ManagerId.Value <= 0)
                    return ServiceResult<ProjectVm>.Fail("Выберите менеджера проекта");

                managerId = dto.ManagerId.Value;
            }
            else
            {
                managerId = currentUserId;
            }

            var manager = await _db.Users.FirstOrDefaultAsync(x => x.Id == managerId);
            if (manager == null)
                return ServiceResult<ProjectVm>.Fail("Менеджер не найден");

            project.Name = dto.Name.Trim();
            project.Description = dto.Description?.Trim() ?? "";
            project.ManagerId = managerId;
            project.ProjectType = NormalizeProjectType(dto.ProjectType);

            var requestedStageNames = (dto.StageNames ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var taskStageNames = await _db.Tasks
                .Where(t => t.ProjectId == project.Id && !string.IsNullOrWhiteSpace(t.StageName))
                .Select(t => t.StageName!)
                .Distinct()
                .ToListAsync();

            foreach (var taskStageName in taskStageNames)
            {
                if (!requestedStageNames.Any(x => string.Equals(x, taskStageName, StringComparison.OrdinalIgnoreCase)))
                    requestedStageNames.Add(taskStageName);
            }

            project.StageNamesJson = SerializeStageNames(requestedStageNames);

            var newMemberIds = (dto.MemberIds ?? new List<int>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (!newMemberIds.Contains(managerId))
                newMemberIds.Add(managerId);

            var existingMembers = await _db.ProjectMembers
                .Where(x => x.ProjectId == project.Id)
                .ToListAsync();

            var membersToDelete = existingMembers
                .Where(x => !newMemberIds.Contains(x.UserId))
                .ToList();

            if (membersToDelete.Count > 0)
                _db.ProjectMembers.RemoveRange(membersToDelete);

            var existingUserIds = existingMembers.Select(x => x.UserId).ToHashSet();

            foreach (var memberId in newMemberIds)
            {
                if (existingUserIds.Contains(memberId))
                    continue;

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

            var loadedProject = await _db.Projects
                .Include(p => p.Manager)
                .Include(p => p.Members)
                .FirstAsync(p => p.Id == project.Id);

            return ServiceResult<ProjectVm>.Success(await BuildProjectVm(loadedProject));
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
            var projectTaskIds = projectTasks.Select(t => t.Id).ToList();

            var relatedManualRequests = await _db.ManualTimeRequests
                .Where(x => (x.ProjectId.HasValue && x.ProjectId.Value == projectId) || projectTaskIds.Contains(x.TaskItemId))
                .ToListAsync();

            if (relatedManualRequests.Count > 0)
                _db.ManualTimeRequests.RemoveRange(relatedManualRequests);

            var relatedActivityLogs = await _db.ActivityLogs
                .Where(x => (x.ProjectId.HasValue && x.ProjectId.Value == projectId) || (x.TaskItemId.HasValue && projectTaskIds.Contains(x.TaskItemId.Value)))
                .ToListAsync();

            if (relatedActivityLogs.Count > 0)
                _db.ActivityLogs.RemoveRange(relatedActivityLogs);

            if (projectTasks.Count > 0)
                _db.Tasks.RemoveRange(projectTasks);

            var projectMembers = await _db.ProjectMembers.Where(x => x.ProjectId == projectId).ToListAsync();
            if (projectMembers.Count > 0)
                _db.ProjectMembers.RemoveRange(projectMembers);

            _db.Projects.Remove(project);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<List<string>> GetAllowedProjectStageNamesAsync(Project project)
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

        public async Task<ProjectVm> BuildProjectVm(Project p)
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

            var calculationStageNames = stageNames.Count > 0
                ? stageNames
                : GetProjectPresetStageNames(p.ProjectType);

            var progress = CalculateProjectProgress(tasks);
            var stageSnapshots = calculationStageNames
                .Select((stageName, index) => new
                {
                    Name = stageName,
                    Index = index,
                    Total = tasks.Count(x => string.Equals(x.StageName ?? "", stageName, StringComparison.OrdinalIgnoreCase)),
                    Progress = CalculateStageProgress(tasks, stageName)
                })
                .ToList();

            var stageProgressPercents = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var stage in stageSnapshots)
            {
                if (!stageProgressPercents.ContainsKey(stage.Name))
                {
                    stageProgressPercents.Add(stage.Name, stage.Progress);
                }
            }

            var currentStage = stageSnapshots.FirstOrDefault(x => x.Total > 0 && x.Progress < 100)
                ?? stageSnapshots.FirstOrDefault(x => x.Total == 0)
                ?? stageSnapshots.FirstOrDefault(x => x.Progress < 100)
                ?? stageSnapshots.LastOrDefault();

            var nextStage = NormalizeProjectType(p.ProjectType) == "linear" && currentStage != null
                ? stageSnapshots.FirstOrDefault(x => x.Index == currentStage.Index + 1)
                : null;

            return new ProjectVm
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                CreatedAt = p.CreatedAt,
                TasksCount = tasks.Count,
                Progress = progress,
                ProgressPercent = progress,
                StageProgressPercent = currentStage?.Progress ?? 0,
                StageProgressPercents = stageProgressPercents,
                CurrentStage = currentStage?.Name ?? "",
                NextStage = nextStage?.Name ?? "",
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

        public static int CalculateProjectProgress(IEnumerable<TaskItem> tasks)
        {
            var taskList = tasks.ToList();
            var tasksCount = taskList.Count;
            var doneCount = taskList.Count(x => x.Status == "done");

            return tasksCount == 0
                ? 0
                : (int)Math.Round(doneCount * 100.0 / tasksCount);
        }

        public static int CalculateStageProgress(IEnumerable<TaskItem> tasks, string stageName)
        {
            var stageTasks = tasks
                .Where(x => string.Equals(x.StageName ?? "", stageName ?? "", StringComparison.OrdinalIgnoreCase))
                .ToList();

            return CalculateProjectProgress(stageTasks);
        }

        public static List<string> ParseStageNames(string? json)
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

        public static bool StageBelongsToProject(string stageName, List<string> allowedStageNames)
        {
            return allowedStageNames.Any(x =>
                string.Equals(x, stageName, StringComparison.OrdinalIgnoreCase));
        }

        public static List<string> GetProjectPresetStageNames(string? projectType)
        {
            return NormalizeProjectType(projectType) switch
            {
                "linear" => new List<string> { "Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск" },
                "hybrid" => new List<string> { "Подготовка", "Разработка / Backend", "Разработка / Frontend", "Сдача / QA", "Сдача / Релиз" },
                _ => new List<string> { "Backend", "Frontend", "UI/UX", "QA", "Docs" }
            };
        }

        public static string NormalizeProjectType(string? value)
        {
            var type = (value ?? "").Trim().ToLower();

            if (type == "linear" || type == "functional" || type == "hybrid")
            {
                return type;
            }

            return "functional";
        }

        public static string GetProjectTypeName(string? value)
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

        private static string SerializeStageNames(List<string>? items)
        {
            var clean = (items ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct()
                .ToList();

            return JsonSerializer.Serialize(clean);
        }

        private static string BuildFullName(string? lastName, string? firstName, string? middleName)
        {
            return string.Join(" ", new[] { lastName, firstName, middleName }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }
    }
}
