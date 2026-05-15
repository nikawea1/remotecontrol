// Файл: RemoteControl1/Pages/Calendar.cshtml.cs
//Calendar.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RemoteControl1.Services;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class CalendarModel : PageModel
    {
        private readonly CalendarService _calendarService;

        public CalendarModel(CalendarService calendarService)
        {
            _calendarService = calendarService;
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

            var data = await _calendarService.GetCalendarPageDataAsync(sessionUserId.Value);
            if (data == null)
                return RedirectToPage("/Auth");

            CurrentUserId = data.CurrentUserId;
            CurrentUserRole = data.CurrentUserRole;
            IsAdmin = data.IsAdmin;
            IsManager = data.IsManager;
            IsEmployee = data.IsEmployee;

            CalendarEventsJson = JsonSerializer.Serialize(data.CalendarItems);
            ProjectsJson = JsonSerializer.Serialize(data.Projects.Select(p => new
            {
                id = p.Id,
                name = p.Name
            }));

            return Page();
        }

        public async Task<JsonResult> OnGetEventsAsync()
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _calendarService.GetEventsAsync(userId);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                items = result.Data
            });
        }

        public async Task<JsonResult> OnPostSaveEventAsync([FromBody] SaveCalendarEventDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _calendarService.SaveEventAsync(userId, new CalendarEventSaveRequest
            {
                Id = dto.Id,
                Title = dto.Title,
                Description = dto.Description,
                EventDate = dto.EventDate,
                EventType = dto.EventType,
                LocationOrLink = dto.LocationOrLink,
                ProjectId = dto.ProjectId
            });

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                calendarEvent = result.Data
            });
        }

        public async Task<JsonResult> OnPostDeleteEventAsync([FromBody] DeleteCalendarEventDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _calendarService.DeleteEventAsync(userId, dto.Id);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        private int CurrentUserOrZero()
        {
            return HttpContext.Session.GetInt32("user_id") ?? 0;
        }

        public class SaveCalendarEventDto
        {
            public int Id { get; set; }
            public string Title { get; set; } = "";
            public string? Description { get; set; }
            public DateTime EventDate { get; set; }
            public string? EventType { get; set; }
            public string? LocationOrLink { get; set; }
            public int? ProjectId { get; set; }
        }

        public class DeleteCalendarEventDto
        {
            public int Id { get; set; }
        }
    }
}