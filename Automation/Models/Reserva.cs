using System;

namespace Automation.Models;

public class Reserva
{
    public Guid Id { get; set; }
    public Guid IdCliente { get; set; }
    public Guid IdEstabelecimento { get; set; }
    public DateTime Data { get; set; }
    public TimeSpan Hora { get; set; }
    public int QuantidadePessoas { get; set; }
    public bool Ativa { get; set; }
    public DateTime CriadoEm { get; set; }
    public string CodigoExibicao { get; set; } = string.Empty;

    public string CodigoFormatado => string.IsNullOrWhiteSpace(CodigoExibicao)
        ? $"#{Id.ToString()[..6].ToUpperInvariant()}"
        : CodigoExibicao.StartsWith('#') ? CodigoExibicao : $"#{CodigoExibicao}";
}
