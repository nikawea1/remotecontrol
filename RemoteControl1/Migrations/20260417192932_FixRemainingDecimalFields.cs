using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RemoteControl1.Migrations
{
    /// <inheritdoc />
    public partial class FixRemainingDecimalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManualTimeRequests_Projects_ProjectId",
                table: "ManualTimeRequests");

            migrationBuilder.AlterColumn<decimal>(
                name: "PlannedTimeHours",
                table: "Tasks",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                oldClrType: typeof(double),
                oldType: "float");

            migrationBuilder.AlterColumn<int>(
                name: "ProjectId",
                table: "ManualTimeRequests",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<decimal>(
                name: "Hours",
                table: "ManualTimeRequests",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                oldClrType: typeof(double),
                oldType: "float");

            migrationBuilder.AddForeignKey(
                name: "FK_ManualTimeRequests_Projects_ProjectId",
                table: "ManualTimeRequests",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManualTimeRequests_Projects_ProjectId",
                table: "ManualTimeRequests");

            migrationBuilder.AlterColumn<double>(
                name: "PlannedTimeHours",
                table: "Tasks",
                type: "float",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)",
                oldPrecision: 10,
                oldScale: 2);

            migrationBuilder.AlterColumn<int>(
                name: "ProjectId",
                table: "ManualTimeRequests",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<double>(
                name: "Hours",
                table: "ManualTimeRequests",
                type: "float",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)",
                oldPrecision: 10,
                oldScale: 2);

            migrationBuilder.AddForeignKey(
                name: "FK_ManualTimeRequests_Projects_ProjectId",
                table: "ManualTimeRequests",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
