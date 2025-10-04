using System;
using System.Threading;
using System.Threading.Tasks;

namespace Automation.Interfaces;

public interface IConversationRepository
{
    Task SalvarContextoAsync(Guid idConversa, string chave, string json, TimeSpan? ttl = null, CancellationToken cancellationToken = default);
    Task<string?> LerContextoAsync(Guid idConversa, string chave, CancellationToken cancellationToken = default);
    Task RemoverContextoAsync(Guid idConversa, string chave, CancellationToken cancellationToken = default);
}
