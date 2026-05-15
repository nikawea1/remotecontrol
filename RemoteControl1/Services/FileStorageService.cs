using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using RemoteControl1.Data;

namespace RemoteControl1.Services
{
    public class FileStorageService
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public FileStorageService(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        public Task<StoredFileResult?> SaveManualTimeAttachmentAsync(int userId, IFormFile? file)
        {
            return SaveUploadAsync(userId, file, "manual-time");
        }

        public Task<StoredFileResult?> SaveScreenshotAsync(int userId, IFormFile? file)
        {
            return SaveUploadAsync(userId, file, "screenshots");
        }

        public Task<StoredFileResult?> SaveWebcamSnapshotAsync(int userId, IFormFile? file)
        {
            return SaveUploadAsync(userId, file, "webcam");
        }

        public string GetSafeUploadPath(params string[] segments)
        {
            var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath)
                ? Path.Combine(_env.ContentRootPath, "wwwroot")
                : _env.WebRootPath;

            var root = Path.Combine(webRoot, "uploads");
            var safeSegments = segments
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => Path.GetFileName(x.Trim()))
                .ToArray();

            return Path.Combine(new[] { root }.Concat(safeSegments).ToArray());
        }

        private async Task<StoredFileResult?> SaveUploadAsync(int userId, IFormFile? file, string uploadType)
        {
            if (file == null || file.Length == 0)
                return null;

            var folder = GetSafeUploadPath(uploadType, userId.ToString());
            Directory.CreateDirectory(folder);

            var extension = Path.GetExtension(file.FileName);
            var safeExtension = string.IsNullOrWhiteSpace(extension) ? ".bin" : extension;
            var savedName = $"{Guid.NewGuid():N}{safeExtension}";
            var fullPath = Path.Combine(folder, savedName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return new StoredFileResult
            {
                Path = $"/uploads/{uploadType}/{userId}/{savedName}",
                Name = Path.GetFileName(file.FileName),
                SavedName = savedName
            };
        }
    }

    public class StoredFileResult
    {
        public string Path { get; set; } = "";
        public string Name { get; set; } = "";
        public string SavedName { get; set; } = "";
    }
}
