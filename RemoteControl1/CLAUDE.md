# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ASP.NET Core 8.0 Razor Pages app (`RemoteControl1`) — internal time-tracking / project-management tool. UI text and commit messages are primarily in Russian.

## Commands

Run from the `RemoteControl1/` project directory (same level as `RemoteControl1.csproj`).

- Restore / build: `dotnet build`
- Run dev server: `dotnet run` (uses `appsettings.Development.json`; URLs configured in `Properties/launchSettings.json`)
- Apply EF Core migrations to the configured DB: `dotnet ef database update`
- Add a new migration: `dotnet ef migrations add <Name>`
- Roll back to a migration: `dotnet ef database update <PreviousMigrationName>`

The `Microsoft.EntityFrameworkCore.Tools` package is referenced in the csproj, so `dotnet ef` works without a global install once `dotnet tool restore` / `dotnet build` has been done. No test project exists in the repo.

## Database

- SQL Server via `Microsoft.EntityFrameworkCore.SqlServer`. Default connection string in `appsettings.json` points to `(localdb)\MSSQLLocalDB`, database `RemoteControlDb`.
- All schema changes go through EF Core migrations under `Migrations/`. `AppDbContextModelSnapshot.cs` is the authoritative model snapshot — do not hand-edit; let `dotnet ef migrations add` regenerate it.
- Decimal columns (hours, money) are configured with explicit `HasPrecision` in `Data/AppDbContext.cs`. When adding decimal fields to entities, add a matching `HasPrecision` in `OnModelCreating` to keep migrations clean.

## Architecture

Razor Pages app with one supporting API controller. The big-picture flow:

- **Entry/DI (`Program.cs`)**: registers `AppDbContext` (SqlServer), Razor Pages, MVC controllers, session (8h idle timeout), `IHttpContextAccessor`, `ICurrentUserService`, `TaskService`. QuestPDF license is set to Community at startup.
- **Auth model**: cookie session only — no ASP.NET Identity. `Pages/Auth.cshtml.cs` and `Pages/Regist.cshtml.cs` set `HttpContext.Session["user_id"]`. `Services/CurrentUserService.cs` reads that session key and resolves the current `User` from the DB on each request. Roles are free-form strings on `User.Role` (`admin` / `manager` / `employee`); `CurrentUserContext` exposes `IsAdmin` / `IsManager` / `CanManage` helpers — use these rather than re-checking role strings.
- **Domain (`Models/`)**: `User`, `Project`, `ProjectMember` (join), `TaskItem`, `ActivityLog` (time tracking, idle/overtime/underwork), `ManualTimeRequest` (employee asks to log time retroactively, optional attachment), `CalendarEvent`. Project has a `ProjectType` (default `"functional"`) and a JSON-serialized `StageNamesJson` for kanban-style stages; `TaskItem.StageName` references one of those names as a string.
- **Pages (`Pages/`)**: each feature is a Razor Page pair (`.cshtml` + `.cshtml.cs`) — `MainPage`, `Tracker`, `Tasks`, `Projects`, `Reports`, `Calendar`, `Users`, `Profile`, `Settings`, plus `Auth` / `Regist`. Page handlers query `AppDbContext` directly; shared logic that doesn't fit a page lives in `Services/`.
- **API (`Controllers/TasksController.cs`)**: the only MVC controller, used by client-side JS in pages that need AJAX task operations. Other features are server-rendered.
- **Services**:
  - `CurrentUserService` — session → `CurrentUserContext`. Inject `ICurrentUserService` and `await GetAsync()` in any page/controller that needs the logged-in user.
  - `TaskService` — task-related business logic shared across pages and the controller.
- **Static assets**: `wwwroot/` (`css`, `js`, `lib`, `uploads/` — uploads are user-supplied attachments, e.g. for `ManualTimeRequest`).
- **PDF/Excel export**: QuestPDF (PDF) and ClosedXML (xlsx) are referenced for report generation from `Pages/Reports.cshtml.cs`.

## Conventions worth knowing

- `Nullable` and `ImplicitUsings` are both enabled — respect nullable annotations rather than suppressing them.
- Entity relationships in `AppDbContext.OnModelCreating` deliberately use `DeleteBehavior.Restrict` for most foreign keys (Users, Projects, Tasks) and `Cascade` only for join tables like `ProjectMember`. Keep this pattern when adding new relationships so deletes don't silently cascade across the domain.
- `Project.StageNamesJson` is a JSON string column — read/write it via `JsonSerializer`, not as a navigation collection.
- Authorization is enforced inside page handlers by checking `CurrentUserContext` flags; there is no `[Authorize]` attribute pipeline. New pages must replicate the session check (typically: resolve current user, redirect to `/Auth` if null, then gate by role).
