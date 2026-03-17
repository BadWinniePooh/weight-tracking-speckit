using System.Net;
using System.Net.Http.Json;
using System.Text;
using WeightTracker.Tests.Integration.Fixtures;
using Xunit;

namespace WeightTracker.Tests.Integration.Endpoints;

public class ImportEndpointsTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateAuthenticatedClient();

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static MultipartFormDataContent CsvContent(string csv, string filename = "import.csv")
    {
        var form = new MultipartFormDataContent();
        var bytes = Encoding.UTF8.GetBytes(csv);
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        form.Add(fileContent, "file", filename);
        return form;
    }

    // ── US1: Successful CSV Import ────────────────────────────────────────────

    [Fact]
    public async Task Import_ValidCsvNoHeader_Returns200WithCorrectCount()
    {
        var csv = """
            2024-01-01,75.5
            2024-01-08,75.1
            2024-01-15,74.8
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(3, body.ImportedCount);
    }

    [Fact]
    public async Task Import_ValidCsvWithHeader_SkipsHeaderReturns200()
    {
        var csv = """
            date,weight
            2024-02-01,76.0
            2024-02-08,75.5
            2024-02-15,75.0
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(3, body.ImportedCount);
    }

    [Fact]
    public async Task Import_NoFileAttached_Returns400()
    {
        var form = new MultipartFormDataContent();

        var response = await _client.PostAsync("/api/import", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_NonCsvFile_Returns400()
    {
        var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent("not a csv"u8.ToArray());
        form.Add(fileContent, "file", "data.txt");

        var response = await _client.PostAsync("/api/import", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_UnauthenticatedRequest_Returns401()
    {
        var unauthClient = fixture.CreateClient();
        var csv = "2024-03-01,75.0";

        var response = await unauthClient.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Import_FileTooLarge_Returns400()
    {
        // Generate a CSV that exceeds 5 MB (~16-17 bytes per line; need >327,680 lines)
        var sb = new StringBuilder();
        for (int i = 0; i < 350_000; i++)
            sb.AppendLine($"2024-01-{(i % 28) + 1:D2},{70 + i % 10}.0");
        var bigCsv = sb.ToString();

        var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(bigCsv));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        form.Add(fileContent, "file", "big.csv");

        var response = await _client.PostAsync("/api/import", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── US2: Partial Import with Error Reporting ──────────────────────────────

    [Fact]
    public async Task Import_MixedValidAndInvalidRows_ImportsValidReportsErrors()
    {
        var csv = """
            2024-04-01,75.0
            2024-04-08,not-a-number
            2024-04-15,74.5
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(2, body.ImportedCount);
        Assert.Equal(1, body.FailedCount);
        Assert.Single(body.Errors);
        Assert.Equal(2, body.Errors[0].Row);
        Assert.Contains("not a valid number", body.Errors[0].Reason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Import_BadDateFormat_ReportsRowError()
    {
        var csv = """
            2024-05-01,75.0
            05/08/2024,74.5
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body.ImportedCount);
        Assert.Equal(1, body.FailedCount);
        Assert.Contains("YYYY-MM-DD", body.Errors[0].Reason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Import_MissingWeight_ReportsRowError()
    {
        var csv = """
            2024-06-01,75.0
            2024-06-08,
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body.ImportedCount);
        Assert.Equal(1, body.FailedCount);
    }

    [Fact]
    public async Task Import_AllInvalidRows_Returns200WithZeroImported()
    {
        var csv = """
            bad-date,75.0
            2024-07-01,not-a-number
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(0, body.ImportedCount);
        Assert.Equal(2, body.FailedCount);
        Assert.Equal(2, body.Errors.Count);
    }

    [Fact]
    public async Task Import_WeightZeroOrNegative_ReportsRowError()
    {
        var csv = """
            2024-08-01,0
            2024-08-08,-5.0
            2024-08-15,75.0
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body.ImportedCount);
        Assert.Equal(2, body.FailedCount);
        Assert.All(body.Errors, e => Assert.Contains("greater than zero", e.Reason, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Import_WeightExceedsKgMax_ReportsRowError()
    {
        var csv = """
            2024-09-01,636.0
            2024-09-08,75.0
            """;

        var response = await _client.PostAsync("/api/import", CsvContent(csv));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body.ImportedCount);
        Assert.Equal(1, body.FailedCount);
        Assert.Contains("out of range", body.Errors[0].Reason, StringComparison.OrdinalIgnoreCase);
    }
}

// ── Response DTOs (test-local) ───────────────────────────────────────────────

record ImportResponse(
    int ImportedCount,
    int FailedCount,
    List<ImportRowError> Errors);

record ImportRowError(int Row, string Reason);
