using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Automation.Interfaces;
using Automation.Models;
using Microsoft.Extensions.Logging;

namespace Automation.Repository;

public class ReservaRepository : IReservaRepository
{
    private readonly ConcurrentDictionary<Guid, Reserva> _reservas = new();
    private readonly ILogger<ReservaRepository> _logger;

    public ReservaRepository(ILogger<ReservaRepository> logger)
    {
        _logger = logger;
    }

    public Task<Reserva?> ObterPorIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _reservas.TryGetValue(id, out var reserva);
        return Task.FromResult(reserva);
    }

    public Task<Reserva?> ObterPorCodigoAsync(string codigo, CancellationToken cancellationToken = default)
    {
        var normalizado = codigo.StartsWith('#') ? codigo[1..] : codigo;
        var reserva = _reservas.Values.FirstOrDefault(r => string.Equals(r.CodigoExibicao, normalizado, StringComparison.OrdinalIgnoreCase) || string.Equals(r.CodigoFormatado.TrimStart('#'), normalizado, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(reserva);
    }

    public Task<IReadOnlyList<Reserva>> ObterAtivasDoClienteAsync(Guid idCliente, Guid idEstabelecimento, DateTime hoje, CancellationToken cancellationToken = default)
    {
        var lista = _reservas.Values
            .Where(r => r.IdCliente == idCliente && r.IdEstabelecimento == idEstabelecimento && r.Ativa && r.Data.Date >= hoje.Date)
            .OrderBy(r => r.Data)
            .ThenBy(r => r.Hora)
            .ToList();
        return Task.FromResult<IReadOnlyList<Reserva>>(lista);
    }

    public Task<bool> ExisteReservaMesmoDiaAsync(Guid idCliente, Guid idEstabelecimento, DateTime dia, CancellationToken cancellationToken = default)
    {
        var existe = _reservas.Values.Any(r => r.IdCliente == idCliente && r.IdEstabelecimento == idEstabelecimento && r.Ativa && r.Data.Date == dia.Date);
        return Task.FromResult(existe);
    }

    public Task<bool> VerificarCapacidadeAsync(Guid idEstabelecimento, DateTime dia, TimeSpan hora, int quantidade, CancellationToken cancellationToken = default)
    {
        // Regra simplificada: capacidade máxima por horário = 50 pessoas.
        const int capacidadeMaxima = 50;
        var ocupacao = _reservas.Values
            .Where(r => r.IdEstabelecimento == idEstabelecimento && r.Data.Date == dia.Date && r.Hora == hora && r.Ativa)
            .Sum(r => r.QuantidadePessoas);
        var disponivel = ocupacao + quantidade <= capacidadeMaxima;
        _logger.LogInformation("INF-RESERVA-VERIFICAR-CAPACIDADE {@Estabelecimento} {@Data} {@Hora} {@Quantidade} {@Disponivel}", idEstabelecimento, dia, hora, quantidade, disponivel);
        return Task.FromResult(disponivel);
    }

    public Task AtualizarReservaAsync(Guid id, TimeSpan hora, int qtdPessoas, CancellationToken cancellationToken = default)
    {
        _reservas.AddOrUpdate(id, _ => throw new InvalidOperationException("Reserva não encontrada"), (_, reserva) =>
        {
            reserva.Hora = hora;
            reserva.QuantidadePessoas = qtdPessoas;
            return reserva;
        });
        _logger.LogInformation("INF-RESERVA-REPO-ATUALIZAR {@Reserva}", id);
        return Task.CompletedTask;
    }

    public Task SalvarAsync(Reserva reserva, CancellationToken cancellationToken = default)
    {
        reserva.CriadoEm = DateTime.UtcNow;
        _reservas[reserva.Id] = reserva;
        _logger.LogInformation("INF-RESERVA-REPO-SALVAR {@Reserva}", reserva.Id);
        return Task.CompletedTask;
    }

    public Task CancelarAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (_reservas.TryGetValue(id, out var reserva))
        {
            reserva.Ativa = false;
            _logger.LogInformation("INF-RESERVA-REPO-CANCELAR {@Reserva}", id);
        }
        return Task.CompletedTask;
    }
}
