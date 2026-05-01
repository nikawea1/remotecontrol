using Microsoft.AspNetCore.Mvc;
using RemoteControl1.Services;

namespace RemoteControl1.Controllers
{
    [ApiController]
    [Route("api/tasks")]
    [ValidateAntiForgeryToken]
    public class TasksController : ControllerBase
    {
        private readonly TaskService _taskService;
        private readonly ICurrentUserService _currentUserService;

        public TasksController(TaskService taskService, ICurrentUserService currentUserService)
        {
            _taskService = taskService;
            _currentUserService = currentUserService;
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddTaskDto dto)
        {
            var currentUser = await _currentUserService.GetAsync();
            if (currentUser == null)
                return Unauthorized(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.AddTaskAsync(currentUser.Id, dto);
            return ToTaskResult(result);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskDto dto)
        {
            var currentUser = await _currentUserService.GetAsync();
            if (currentUser == null)
                return Unauthorized(new { ok = false, error = "Пользователь не найден" });

            dto.Id = id;
            var result = await _taskService.UpdateTaskAsync(currentUser.Id, dto);
            return ToTaskResult(result);
        }

        [HttpPost("{id:int}/review")]
        public async Task<IActionResult> SubmitForReview(int id, [FromBody] SubmitTaskForReviewDto dto)
        {
            var currentUser = await _currentUserService.GetAsync();
            if (currentUser == null)
                return Unauthorized(new { ok = false, error = "Пользователь не найден" });

            dto.Id = id;
            var result = await _taskService.SubmitTaskForReviewAsync(currentUser.Id, dto);
            return ToTaskResult(result);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var currentUser = await _currentUserService.GetAsync();
            if (currentUser == null)
                return Unauthorized(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.DeleteTaskAsync(currentUser.Id, id);
            if (!result.Ok)
                return BadRequest(new { ok = false, error = result.Error });

            return Ok(new { ok = true });
        }

        private IActionResult ToTaskResult(ServiceResult<TaskVm> result)
        {
            if (!result.Ok)
                return BadRequest(new { ok = false, error = result.Error, task = result.Data });

            return Ok(new { ok = true, error = result.Error, task = result.Data });
        }
    }
}
