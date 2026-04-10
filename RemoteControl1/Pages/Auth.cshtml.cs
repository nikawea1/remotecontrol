using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;

namespace RemoteControl1.Pages;

public class AuthModel : PageModel
{
    private readonly AppDbContext _db;

    public AuthModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? Error { get; set; }

    public class InputModel
    {
        [Required(ErrorMessage = "Введите email или логин")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Введите пароль")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = "";
    }

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        var loginOrEmail = (Input.Email ?? "").Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == loginOrEmail ||
            u.Login.ToLower() == loginOrEmail);

        if (user == null)
        {
            Error = "Пользователь не найден";
            return Page();
        }

        if (!user.IsActive)
        {
            Error = "Пользователь заблокирован";
            return Page();
        }

        var hash = Hash(Input.Password);
        if (user.PasswordHash != hash)
        {
            Error = "Неверный пароль";
            return Page();
        }

        HttpContext.Session.SetInt32("user_id", user.Id);
        HttpContext.Session.SetString("user_name", user.FirstName);
        HttpContext.Session.SetString("user_email", user.Email);
        HttpContext.Session.SetString("user_role", user.Role ?? "employee");

        return RedirectToPage("/MainPage");
    }

    private static string Hash(string value)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }


}


