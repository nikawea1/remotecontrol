using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Services
{
    public class ProfileService
    {
        private readonly AppDbContext _db;

        public ProfileService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<ServiceResult<ProfileSettingsVm>> GetProfileAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<ProfileSettingsVm>.Fail("Пользователь не найден");

            return ServiceResult<ProfileSettingsVm>.Success(ProfileSettingsVm.FromUser(user));
        }

        public async Task<ServiceResult> SaveProfileContactNoteAsync(int userId, string? contactNote)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            user.ContactNote = contactNote?.Trim() ?? "";
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult> SaveProfilePreferencesAsync(
            int userId,
            bool notifyInUi,
            bool rememberLastTask,
            bool allowScreenShots,
            bool allowWebcamShots,
            string? personalNote)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            user.NotifyInUi = notifyInUi;
            user.RememberLastTask = rememberLastTask;
            user.AllowScreenShots = allowScreenShots;
            user.AllowWebcamShots = allowWebcamShots;
            user.PersonalNote = personalNote?.Trim() ?? "";

            await _db.SaveChangesAsync();

            return ServiceResult.Success();
        }

        public async Task<ServiceResult<ProfileSettingsVm>> SaveProfileAsync(
            int userId,
            string? email,
            string? phone,
            string? contactNote,
            bool notifyInUi,
            bool rememberLastTask,
            bool allowScreenShots,
            bool allowWebcamShots,
            int screenIntervalSeconds,
            int webcamIntervalSeconds,
            int idleTimeoutMinutes,
            string? personalNote)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<ProfileSettingsVm>.Fail("Пользователь не найден");

            var normalizedEmail = (email ?? "").Trim().ToLowerInvariant();
            var normalizedPhone = (phone ?? "").Trim();

            if (string.IsNullOrWhiteSpace(normalizedEmail))
                return ServiceResult<ProfileSettingsVm>.Fail("Введите email");

            if (!new EmailAddressAttribute().IsValid(normalizedEmail))
                return ServiceResult<ProfileSettingsVm>.Fail("Некорректный email");

            var emailBusy = await _db.Users.AnyAsync(x => x.Email == normalizedEmail && x.Id != user.Id);
            if (emailBusy)
                return ServiceResult<ProfileSettingsVm>.Fail("Этот email уже занят");

            user.Email = normalizedEmail;
            user.Phone = string.IsNullOrWhiteSpace(normalizedPhone) ? null : normalizedPhone;
            user.ContactNote = contactNote?.Trim() ?? "";
            user.NotifyInUi = notifyInUi;
            user.RememberLastTask = rememberLastTask;
            user.AllowScreenShots = allowScreenShots;
            user.AllowWebcamShots = allowWebcamShots;
            user.PersonalNote = personalNote?.Trim() ?? "";
            user.ScreenIntervalSeconds = screenIntervalSeconds < 5 ? 5 : screenIntervalSeconds;
            user.WebcamIntervalSeconds = webcamIntervalSeconds < 5 ? 5 : webcamIntervalSeconds;
            user.IdleTimeoutMinutes = idleTimeoutMinutes < 1 ? 1 : idleTimeoutMinutes;

            await _db.SaveChangesAsync();

            return ServiceResult<ProfileSettingsVm>.Success(ProfileSettingsVm.FromUser(user));
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

        private static string HashPassword(string value)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            return Convert.ToHexString(
                sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))
            );
        }
    }

    public class ProfileSettingsVm
    {
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public string ContactNote { get; set; } = "";
        public string PersonalNote { get; set; } = "";
        public bool NotifyInUi { get; set; }
        public bool RememberLastTask { get; set; }
        public bool AllowScreenShots { get; set; }
        public bool AllowWebcamShots { get; set; }
        public int ScreenIntervalSeconds { get; set; }
        public int WebcamIntervalSeconds { get; set; }
        public int IdleTimeoutMinutes { get; set; }

        public static ProfileSettingsVm FromUser(Models.User user)
        {
            return new ProfileSettingsVm
            {
                Email = user.Email ?? "",
                Phone = user.Phone ?? "",
                ContactNote = user.ContactNote ?? "",
                PersonalNote = user.PersonalNote ?? "",
                NotifyInUi = user.NotifyInUi,
                RememberLastTask = user.RememberLastTask,
                AllowScreenShots = user.AllowScreenShots,
                AllowWebcamShots = user.AllowWebcamShots,
                ScreenIntervalSeconds = user.ScreenIntervalSeconds,
                WebcamIntervalSeconds = user.WebcamIntervalSeconds,
                IdleTimeoutMinutes = user.IdleTimeoutMinutes
            };
        }
    }
}
