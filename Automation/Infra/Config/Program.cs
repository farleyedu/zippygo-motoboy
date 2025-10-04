using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Automation.Dtos;
using Automation.Interfaces;
using Automation.Repository;
using Automation.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Extensions.Http;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddLogging();
builder.Services.AddMemoryCache();

builder.Services.AddHttpClient("OpenAI", (sp, client) =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var baseUrl = configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/";
    var timeoutSeconds = configuration.GetValue("OpenAI:TimeoutSeconds", 45);
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
}).AddPolicyHandler(PollyPolicies.ObterRetryPolicy());

builder.Services.AddSingleton<IConversationRepository, ConversationRepository>();
builder.Services.AddSingleton<IReservaRepository, ReservaRepository>();
builder.Services.AddSingleton<ConversationContextService>();
builder.Services.AddSingleton<ReservaService>();
builder.Services.AddSingleton<ToolExecutorService>();
builder.Services.AddSingleton<HandoverService>();
builder.Services.AddSingleton<IAssistantService, AssistantService>();

var app = builder.Build();

app.UseMiddleware<IdempotencyMiddleware>();

app.MapPost("/wa/webhook", async (IAssistantService assistantService, AssistantDecision decisao, CancellationToken cancellationToken) =>
{
    await assistantService.ProcessarMensagemAsync(decisao, cancellationToken);
    return Results.Ok();
});

app.Run();

public static class PollyPolicies
{
    public static IAsyncPolicy<HttpResponseMessage> ObterRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .Or<TaskCanceledException>()
            .WaitAndRetryAsync(2, tentativa => TimeSpan.FromSeconds(Math.Pow(2, tentativa)));
    }
}

public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<IdempotencyMiddleware> _logger;

    public IdempotencyMiddleware(RequestDelegate next, IMemoryCache memoryCache, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/wa/webhook", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.EnableBuffering();
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;

            try
            {
                using var document = JsonDocument.Parse(body);
                var root = document.RootElement;
                if (root.TryGetProperty("idConversa", out var idConversaProp) && Guid.TryParse(idConversaProp.GetString(), out var idConversa))
                {
                    var texto = root.TryGetProperty("texto", out var textoProp) ? textoProp.GetString() ?? string.Empty : string.Empty;
                    var chave = GerarChave(idConversa, texto);
                    if (_memoryCache.TryGetValue(chave, out _))
                    {
                        _logger.LogInformation("INF-IDEMPOTENCIA-WEBHOOK-IGNORADA {@Chave}", chave);
                        context.Response.StatusCode = StatusCodes.Status202Accepted;
                        await context.Response.WriteAsync("Mensagem já processada recentemente.");
                        return;
                    }

                    _memoryCache.Set(chave, true, TimeSpan.FromMinutes(2));
                    _logger.LogInformation("INF-IDEMPOTENCIA-WEBHOOK-REGISTRADA {@Chave}", chave);
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "WRN-IDEMPOTENCIA-WEBHOOK-JSON-INVALIDO");
            }
        }

        await _next(context);
    }

    private static string GerarChave(Guid idConversa, string texto)
    {
        var ticksTruncados = DateTime.UtcNow.Ticks / TimeSpan.FromMinutes(1).Ticks;
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(texto ?? string.Empty)));
        return $"webhook:{idConversa}:{hash}:{ticksTruncados}";
    }
}
