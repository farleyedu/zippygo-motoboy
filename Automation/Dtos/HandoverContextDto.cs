using System;

namespace Automation.Dtos;

public class HandoverContextDto
{
    public string? AcaoSolicitada { get; set; }
    public TentativaReservaSnapshotDto? TentativaReservaSnapshot { get; set; }
    public string? CodigoReserva { get; set; }
    public string? ResumoConflito { get; set; }
    public string? Observacoes { get; set; }
}

public class TentativaReservaSnapshotDto
{
    public string? NomeCliente { get; set; }
    public int? QuantidadePessoas { get; set; }
    public DateTime? Data { get; set; }
    public TimeSpan? Hora { get; set; }
}
