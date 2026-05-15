using RemoteControl1.Data;

namespace RemoteControl1.Services
{
    public class SettingsService
    {
        private readonly AppDbContext _db;

        public SettingsService(AppDbContext db)
        {
            _db = db;
        }
    }
}
