using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;

namespace RemoteControl1.Pages;

public class RegistModel : PageModel
{
    private readonly AppDbContext _db;

    public RegistModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? Error { get; set; }

    public class InputModel
    {
        [Required(ErrorMessage = "Введите имя")]
        [MinLength(2, ErrorMessage = "Имя минимум 2 символа")]
        public string FirstName { get; set; } = "";

        [Required(ErrorMessage = "Введите фамилию")]
        [MinLength(2, ErrorMessage = "Фамилия минимум 2 символа")]
        public string LastName { get; set; } = "";

        [Required(ErrorMessage = "Введите email")]
        [EmailAddress(ErrorMessage = "Некорректный email")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Введите пароль")]
        [MinLength(6, ErrorMessage = "Пароль минимум 6 символов")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = "";

        [Required(ErrorMessage = "Подтвердите пароль")]
        [DataType(DataType.Password)]
        public string ConfirmPassword { get; set; } = "";
    }

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        if (Input.Password != Input.ConfirmPassword)
        {
            Error = "Пароли не совпадают";
            return Page();
        }

        var email = (Input.Email ?? "").Trim().ToLowerInvariant();

        var login = email.Split('@')[0].Trim();

        var exists = await _db.Users.AnyAsync(u => u.Email == email);
        if (exists)
        {
            Error = "Пользователь с таким email уже существует";
            return Page();
        }

        var loginExists = await _db.Users.AnyAsync(u => u.Login == login);
        if (loginExists)
        {
            Error = "Пользователь с таким логином уже существует";
            return Page();
        }

        var user = new User
        {
            FirstName = (Input.FirstName ?? "").Trim(),
            LastName = (Input.LastName ?? "").Trim(),
            MiddleName = null,
            Email = email,
            Login = login,
            PasswordHash = HashPassword(Input.Password),
            Role = "employee",
            Position = "Сотрудник",
            HourlyRate = 0,
            Phone = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            IsWorking = false,
            WorkStartUtc = null
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // "логин" в сессию
        HttpContext.Session.SetInt32("user_id", user.Id);
        HttpContext.Session.SetString("user_name", user.FirstName);
        HttpContext.Session.SetString("user_email", user.Email);
        HttpContext.Session.SetString("user_role", user.Role ?? "employee");

        return RedirectToPage("/MainPage");
    }

    private static string HashPassword(string value)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        return Convert.ToHexString(
            sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))
        );
    }
    private static string Hash(string value)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }
}