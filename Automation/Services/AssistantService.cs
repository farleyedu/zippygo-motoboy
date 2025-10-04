using System;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Automation.Dtos;
using Automation.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class AssistantService : IAssistantService
{
    private readonly ToolExecutorService _toolExecutorService;
    private readonly ConversationContextService _conversationContextService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<AssistantService> _logger;

    public AssistantService(
        ToolExecutorService toolExecutorService,
        ConversationContextService conversationContextService,
        IHttpClientFactory httpClientFactory,
        IMemoryCache memoryCache,
        ILogger<AssistantService> logger)
    {
        _toolExecutorService = toolExecutorService;
        _conversationContextService = conversationContextService;
        _httpClientFactory = httpClientFactory;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    public async Task ProcessarMensagemAsync(AssistantDecision decisao, CancellationToken cancellationToken = default)
    {
        if (decisao is null)
        {
            throw new ArgumentNullException(nameof(decisao));
        }

        if (!RegistrarIdempotencia(decisao))
        {
            _logger.LogInformation("INF-ASSISTANT-IDEMPOTENTE {@Conversa}", decisao.IdConversa);
            return;
        }

        await HidratarMemoriaAsync(decisao, cancellationToken);

        ToolExecutionResult resultado;
        if (decisao.EhAcao(AssistantDecision.Acoes.ConsultarReserva))
        {
            resultado = await _toolExecutorService.HandleConsultarReservaAsync(decisao, cancellationToken);
        }
        else if (decisao.EhAcao(AssistantDecision.Acoes.AtualizarReserva))
        {
            resultado = await _toolExecutorService.HandleAtualizarReservaAsync(decisao, cancellationToken);
        }
        else if (decisao.EhAcao(AssistantDecision.Acoes.ConfirmarReserva))
        {
            resultado = await _toolExecutorService.HandleConfirmarReservaAsync(decisao, cancellationToken);
        }
        else
        {
            _logger.LogWarning("WRN-ASSISTANT-ACAO-DESCONHECIDA {@Acao}", decisao.Acao);
            resultado = ToolExecutionResult.Falha("Ainda não sei lidar com esse pedido. Pode tentar reformular?");
        }

        _logger.LogInformation("INF-ASSISTANT-RESULTADO {@Acao} {@Sucesso} {@Mensagem}", decisao.Acao, resultado.Success, resultado.Message);
    }

    private bool RegistrarIdempotencia(AssistantDecision decisao)
    {
        if (decisao.IdConversa is null)
        {
            return true;
        }

        var texto = decisao.ContextoAdicional != null && decisao.ContextoAdicional.TryGetValue("texto_usuario", out var valorTexto)
            ? valorTexto?.ToString() ?? string.Empty
            : string.Empty;

        var ticksTruncados = DateTime.UtcNow.Ticks / TimeSpan.FromMinutes(1).Ticks;
        var hashEntrada = CalcularHash($"{decisao.IdConversa}:{texto}");
        var chave = $"idemp:{decisao.IdConversa}:{hashEntrada}:{ticksTruncados}";

        if (_memoryCache.TryGetValue(chave, out _))
        {
            _logger.LogInformation("INF-ASSISTANT-IDEMPOTENCIA-IGNORADA {@Chave}", chave);
            return false;
        }

        _memoryCache.Set(chave, true, TimeSpan.FromMinutes(2));
        _logger.LogInformation("INF-ASSISTANT-IDEMPOTENCIA-REGISTRADA {@Chave}", chave);
        return true;
    }

    private async Task HidratarMemoriaAsync(AssistantDecision decisao, CancellationToken cancellationToken)
    {
        if (decisao.IdConversa is null)
        {
            return;
        }

        var snapshot = await _conversationContextService.LerAsync<TentativaReservaSnapshotDto>(decisao.IdConversa.Value, "tentativa_reserva", cancellationToken);
        if (snapshot is null)
        {
            return;
        }

        bool alterado = false;
        if (string.IsNullOrWhiteSpace(decisao.NomeCliente) && !string.IsNullOrWhiteSpace(snapshot.NomeCliente))
        {
            decisao.NomeCliente = snapshot.NomeCliente;
            alterado = true;
        }

        if (decisao.QuantidadePessoas is null && snapshot.QuantidadePessoas.HasValue)
        {
            decisao.QuantidadePessoas = snapshot.QuantidadePessoas;
            alterado = true;
        }

        if (decisao.Data is null && snapshot.Data.HasValue)
        {
            decisao.Data = snapshot.Data;
            alterado = true;
        }

        if (decisao.Hora is null && snapshot.Hora.HasValue)
        {
            decisao.Hora = snapshot.Hora;
            alterado = true;
        }

        if (alterado)
        {
            _logger.LogInformation("INF-ASSISTANT-MEMORIA-HIDRATADA {@Conversa} {@Snapshot}", decisao.IdConversa, JsonSerializer.Serialize(snapshot));
        }
    }

    private async Task<string> EnviarParaOpenAIAsync(string payload, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("OpenAI");
        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var response = await client.SendAsync(request, cancellationToken);
            stopwatch.Stop();
            _logger.LogInformation("INF-ASSISTANT-OPENAI-LATENCIA {LatenciaMs}", stopwatch.ElapsedMilliseconds);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (TaskCanceledException ex)
        {
            stopwatch.Stop();
            _logger.LogWarning(ex, "WRN-ASSISTANT-OPENAI-TIMEOUT {LatenciaMs}", stopwatch.ElapsedMilliseconds);
            return "Desculpe, a resposta está demorando um pouco. Vamos continuar com as informações que já temos.";
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "ERR-ASSISTANT-OPENAI-FALHA {LatenciaMs}", stopwatch.ElapsedMilliseconds);
            throw;
        }
    }

    private static string CalcularHash(string texto)
    {
        var bytes = Encoding.UTF8.GetBytes(texto);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
