using System;
using System.Threading;
using System.Threading.Tasks;
using Automation.Dtos;
using Automation.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class AssistantProcessingHostedService : BackgroundService
{
    private readonly AssistantDecisionQueue _queue;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger<AssistantProcessingHostedService> _logger;

    public AssistantProcessingHostedService(
        AssistantDecisionQueue queue,
        IServiceScopeFactory serviceScopeFactory,
        ILogger<AssistantProcessingHostedService> logger)
    {
        _queue = queue;
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var decisao in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var assistantService = scope.ServiceProvider.GetRequiredService<IAssistantService>();
                await assistantService.ProcessarMensagemAsync(decisao, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ERR-ASSISTANT-FILA-PROCESSAMENTO {Conversa}", decisao.IdConversa);
            }
        }
    }
}
