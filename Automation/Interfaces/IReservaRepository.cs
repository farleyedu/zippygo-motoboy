using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Automation.Models;

namespace Automation.Interfaces;

public interface IReservaRepository
{
    Task<Reserva?> ObterPorIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Reserva?> ObterPorCodigoAsync(string codigo, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Reserva>> ObterAtivasDoClienteAsync(Guid idCliente, Guid idEstabelecimento, DateTime hoje, CancellationToken cancellationToken = default);
    Task<bool> ExisteReservaMesmoDiaAsync(Guid idCliente, Guid idEstabelecimento, DateTime dia, CancellationToken cancellationToken = default);
    Task<bool> VerificarCapacidadeAsync(Guid idEstabelecimento, DateTime dia, TimeSpan hora, int quantidade, CancellationToken cancellationToken = default);
    Task AtualizarReservaAsync(Guid id, TimeSpan hora, int qtdPessoas, CancellationToken cancellationToken = default);
    Task SalvarAsync(Reserva reserva, CancellationToken cancellationToken = default);
    Task CancelarAsync(Guid id, CancellationToken cancellationToken = default);
}
