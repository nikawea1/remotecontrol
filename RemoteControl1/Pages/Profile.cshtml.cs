//Profile.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Services;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class ProfileModel : PageModel
    {
        private readonly AppDbContext _db;
        private readonly TaskService _taskService;

        public ProfileModel(AppDbContext db, TaskService taskService)
        {
            _db = db;
            _taskService = taskService;
        }

        public int CurrentUserId { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string CurrentUserName { get; set; } = "";
        public string CurrentUserEmail { get; set; } = "";
        public string CurrentUserLogin { get; set; } = "";
        public string CurrentUserPhone { get; set; } = "";
        public string CurrentUserPosition { get; set; } = "";
        public decimal CurrentUserRate { get; set; }
        public bool CurrentUserIsActive { get; set; }

        public string TasksJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";
        public string ActivityJson { get; set; } = "[]";

        public async Task<IActionResult> OnGetAsync()
        {
            var sessionUserId = HttpContext.Session.GetInt32("user_id");
            if (sessionUserId == null || sessionUserId <= 0)
                return RedirectToPage("/Auth");

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == sessionUserId.Value);
            if (user == null)
                return RedirectToPage("/Auth");

            CurrentUserId = user.Id;
            CurrentUserRole = (user.Role ?? "").ToLower();
            IsAdmin = CurrentUserRole == "admin";
            IsManager = !IsAdmin && CurrentUserRole == "manager";
            IsEmployee = !IsAdmin && !IsManager;

            CurrentUserName = HttpContext.Session.GetString("user_name") ?? "";
            CurrentUserEmail = HttpContext.Session.GetString("user_email") ?? "";
            CurrentUserLogin = user.Login ?? "";
            CurrentUserPhone = user.Phone ?? "";
            CurrentUserPosition = user.Position ?? "";
            CurrentUserRate = user.HourlyRate;
            CurrentUserIsActive = user.IsActive;

            var data = await _taskService.GetPageDataAsync(user.Id);

            TasksJson = JsonSerializer.Serialize(data.Tasks);
            ProjectsJson = JsonSerializer.Serialize(data.Projects);
            ActivityJson = JsonSerializer.Serialize(data.Activity);

            return Page();
        }
    }
}