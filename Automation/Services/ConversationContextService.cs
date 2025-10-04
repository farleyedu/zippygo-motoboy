using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Automation.Interfaces;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class ConversationContextService
{
    private readonly IConversationRepository _repository;
    private readonly ILogger<ConversationContextService> _logger;
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public ConversationContextService(IConversationRepository repository, ILogger<ConversationContextService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task SalvarAsync<T>(Guid idConversa, string chave, T payload, TimeSpan? ttl = null, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(payload, SerializerOptions);
        _logger.LogInformation("INF-CONVERSATION-CONTEXT-SAVE {@Chave} {@Id}", chave, idConversa);
        await _repository.SalvarContextoAsync(idConversa, chave, json, ttl, cancellationToken);
    }

    public async Task<T?> LerAsync<T>(Guid idConversa, string chave, CancellationToken cancellationToken = default)
    {
        var json = await _repository.LerContextoAsync(idConversa, chave, cancellationToken);
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, SerializerOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WRN-CONVERSATION-CONTEXT-DESERIALIZE {@Chave} {@Id}", chave, idConversa);
            return default;
        }
    }

    public Task RemoverAsync(Guid idConversa, string chave, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("INF-CONVERSATION-CONTEXT-REMOVE {@Chave} {@Id}", chave, idConversa);
        return _repository.RemoverContextoAsync(idConversa, chave, cancellationToken);
    }
}
