using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeightTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChartSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreferredUnit = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    WeightGoal = table.Column<decimal>(type: "numeric(10,4)", nullable: true),
                    LossRate = table.Column<decimal>(type: "numeric(10,6)", nullable: false),
                    CarbFatRatio = table.Column<decimal>(type: "numeric(10,6)", nullable: false),
                    BufferValue = table.Column<decimal>(type: "numeric(10,6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChartSettings", x => x.Id);
                    table.CheckConstraint("CK_ChartSettings_PreferredUnit", "\"PreferredUnit\" IN ('kg','lbs')");
                    table.ForeignKey(
                        name: "FK_ChartSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WeightEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightValue = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    Unit = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeightEntries", x => x.Id);
                    table.CheckConstraint("CK_WeightEntries_Unit", "\"Unit\" IN ('kg','lbs')");
                    table.ForeignKey(
                        name: "FK_WeightEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChartSettings_UserId",
                table: "ChartSettings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeightEntries_UserId_Timestamp",
                table: "WeightEntries",
                columns: new[] { "UserId", "Timestamp" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChartSettings");

            migrationBuilder.DropTable(
                name: "WeightEntries");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
