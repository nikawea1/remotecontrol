using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;

namespace RemoteControl1.Services
{
    public sealed class CurrentUserContext
    {
        public int Id { get; init; }
        public string FullName { get; init; } = "";
        public string Email { get; init; } = "";
        public string Role { get; init; } = "employee";
        public bool IsAdmin => Role == "admin";
        public bool IsManager => Role == "manager";
        public bool IsEmployee => !IsAdmin && !IsManager;
        public bool CanManage => IsAdmin || IsManager;
    }

    public interface ICurrentUserService
    {
        Task<CurrentUserContext?> GetAsync();
    }

    public sealed class CurrentUserService : ICurrentUserService
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<CurrentUserContext?> GetAsync()
        {
            var sessionUserId = _httpContextAccessor.HttpContext?.Session.GetInt32("user_id");
            if (sessionUserId == null || sessionUserId <= 0)
                return null;

            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == sessionUserId.Value);

            if (user == null)
                return null;

            var fullName = string.Join(" ", new[]
            {
                user.LastName,
                user.FirstName,
                user.MiddleName
            }.Where(part => !string.IsNullOrWhiteSpace(part)));

            return new CurrentUserContext
            {
                Id = user.Id,
                FullName = fullName,
                Email = user.Email ?? "",
                Role = (user.Role ?? "employee").ToLowerInvariant()
            };
        }
    }
}
