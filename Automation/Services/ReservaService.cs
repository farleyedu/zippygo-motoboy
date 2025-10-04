using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Automation.Interfaces;
using Automation.Models;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class ReservaService
{
    private readonly IReservaRepository _reservaRepository;
    private readonly ILogger<ReservaService> _logger;

    public ReservaService(IReservaRepository reservaRepository, ILogger<ReservaService> logger)
    {
        _reservaRepository = reservaRepository;
        _logger = logger;
    }

    public async Task<Reserva?> ObterReservaPorCodigoAsync(string codigo, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigo))
        {
            return null;
        }

        var normalizado = codigo.StartsWith('#') ? codigo[1..] : codigo;
        _logger.LogInformation("INF-RESERVA-BUSCA-CODIGO {@Codigo}", normalizado);
        return await _reservaRepository.ObterPorCodigoAsync(normalizado, cancellationToken);
    }

    public async Task<IReadOnlyList<Reserva>> ObterReservasAtivasDoClienteAsync(Guid clienteId, Guid estabelecimentoId, DateTime referencia, CancellationToken cancellationToken = default)
    {
        var resultado = await _reservaRepository.ObterAtivasDoClienteAsync(clienteId, estabelecimentoId, referencia.Date, cancellationToken);
        _logger.LogInformation("INF-RESERVA-BUSCA-ATIVAS {@Cliente} {@Estabelecimento} {@Quantidade}", clienteId, estabelecimentoId, resultado.Count);
        return resultado;
    }

    public async Task<bool> ExisteConflitoMesmoDiaAsync(Guid clienteId, Guid estabelecimentoId, DateTime data, CancellationToken cancellationToken = default)
    {
        var existe = await _reservaRepository.ExisteReservaMesmoDiaAsync(clienteId, estabelecimentoId, data.Date, cancellationToken);
        _logger.LogInformation("INF-RESERVA-CONFLITO-MESMO-DIA {@Cliente} {@Estabelecimento} {@Data} {@Existe}", clienteId, estabelecimentoId, data.Date, existe);
        return existe;
    }

    public async Task<bool> AtualizarReservaComCapacidadeAsync(Guid reservaId, Guid estabelecimentoId, DateTime data, TimeSpan novaHora, int novaQtd, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("INF-RESERVA-ATUALIZAR-REQUEST {@Reserva} {@Hora} {@Qtd}", reservaId, novaHora, novaQtd);
        var possuiCapacidade = await _reservaRepository.VerificarCapacidadeAsync(estabelecimentoId, data.Date, novaHora, novaQtd, cancellationToken);
        if (!possuiCapacidade)
        {
            _logger.LogWarning("WRN-RESERVA-ATUALIZAR-SEM-CAPACIDADE {@Reserva}", reservaId);
            return false;
        }

        await _reservaRepository.AtualizarReservaAsync(reservaId, novaHora, novaQtd, cancellationToken);
        _logger.LogInformation("INF-RESERVA-ATUALIZADA {@Reserva}", reservaId);
        return true;
    }

    public string MontarResumoReserva(Reserva reserva)
    {
        return $"📅 Data: {reserva.Data:dd/MM/yyyy}\n⏰ Horário: {reserva.Hora:hh\\:mm}\n👥 Pessoas: {reserva.QuantidadePessoas}";
    }

    public Reserva? SelecionarReservaMesmoDia(IEnumerable<Reserva> reservas, DateTime data)
    {
        return reservas.FirstOrDefault(r => r.Data.Date == data.Date && r.Ativa);
    }
}
