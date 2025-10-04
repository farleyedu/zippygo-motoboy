using System;
using Automation.Dtos;
using Automation.Models;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class HandoverService
{
    private readonly ILogger<HandoverService> _logger;

    public HandoverService(ILogger<HandoverService> logger)
    {
        _logger = logger;
    }

    public HandoverContextDto GerarContexto(string acaoSolicitada, Reserva? reservaConflitante, TentativaReservaSnapshotDto? snapshot, string? codigoReserva, string? resumoExtra)
    {
        var contexto = new HandoverContextDto
        {
            AcaoSolicitada = acaoSolicitada,
            TentativaReservaSnapshot = snapshot,
            CodigoReserva = codigoReserva,
            ResumoConflito = reservaConflitante != null ? $"Conflito detectado em {reservaConflitante.Data:dd/MM/yyyy} às {reservaConflitante.Hora:hh\\:mm} para {reservaConflitante.QuantidadePessoas} pessoas." : null,
            Observacoes = resumoExtra
        };

        _logger.LogInformation("INF-HANDOVER-CONTEXTO {@Acao} {@Codigo}", acaoSolicitada, codigoReserva);
        return contexto;
    }
}
