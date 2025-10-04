using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Automation.Interfaces;
using Microsoft.Extensions.Logging;

namespace Automation.Repository;

public class ConversationRepository : IConversationRepository
{
    private readonly ConcurrentDictionary<(Guid, string), (string Json, DateTime? Expira)> _contextos = new();
    private readonly ILogger<ConversationRepository> _logger;

    public ConversationRepository(ILogger<ConversationRepository> logger)
    {
        _logger = logger;
    }

    public Task SalvarContextoAsync(Guid idConversa, string chave, string json, TimeSpan? ttl = null, CancellationToken cancellationToken = default)
    {
        var expira = ttl.HasValue ? DateTime.UtcNow.Add(ttl.Value) : null;
        _contextos[(idConversa, chave)] = (json, expira);
        _logger.LogInformation("INF-CONVERSATION-REPO-SALVAR {@Conversa} {@Chave}", idConversa, chave);
        return Task.CompletedTask;
    }

    public Task<string?> LerContextoAsync(Guid idConversa, string chave, CancellationToken cancellationToken = default)
    {
        if (_contextos.TryGetValue((idConversa, chave), out var registro))
        {
            if (registro.Expira.HasValue && registro.Expira.Value < DateTime.UtcNow)
            {
                _contextos.TryRemove((idConversa, chave), out _);
                return Task.FromResult<string?>(null);
            }

            return Task.FromResult<string?>(registro.Json);
        }

        return Task.FromResult<string?>(null);
    }

    public Task RemoverContextoAsync(Guid idConversa, string chave, CancellationToken cancellationToken = default)
    {
        _contextos.TryRemove((idConversa, chave), out _);
        _logger.LogInformation("INF-CONVERSATION-REPO-REMOVER {@Conversa} {@Chave}", idConversa, chave);
        return Task.CompletedTask;
    }
}
