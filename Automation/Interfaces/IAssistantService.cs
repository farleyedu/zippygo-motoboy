using System.Threading;
using System.Threading.Tasks;
using Automation.Dtos;

namespace Automation.Interfaces;

public interface IAssistantService
{
    Task ProcessarMensagemAsync(AssistantDecision decisao, CancellationToken cancellationToken = default);
}
