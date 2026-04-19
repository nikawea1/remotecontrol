//Calendar.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class CalendarModel : PageModel
    {
        private readonly AppDbContext _db;

        public CalendarModel(AppDbContext db)
        {
            _db = db;
        }

        public int CurrentUserId { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string CalendarEventsJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";

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

            List<CalendarEvent> events;

            if (IsAdmin || IsManager)
            {
                events = await _db.CalendarEvents
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }
            else
            {
                events = await _db.CalendarEvents
                    .Where(x => x.UserId == user.Id)
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }

            var projects = await _db.Projects
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name
                })
                .OrderBy(p => p.name)
                .ToListAsync();

            CalendarEventsJson = JsonSerializer.Serialize(events);
            ProjectsJson = JsonSerializer.Serialize(projects);

            return Page();
        }
    }
}