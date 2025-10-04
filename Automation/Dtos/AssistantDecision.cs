using System;
using System.Collections.Generic;

namespace Automation.Dtos;

public class AssistantDecision
{
    public string? Acao { get; set; }
    public string? CodigoReserva { get; set; }
    public Guid? IdConversa { get; set; }
    public Guid? IdCliente { get; set; }
    public Guid? IdEstabelecimento { get; set; }
    public string? NomeCliente { get; set; }
    public int? QuantidadePessoas { get; set; }
    public DateTime? Data { get; set; }
    public TimeSpan? Hora { get; set; }
    public IDictionary<string, string>? MemoriaHidratada { get; set; }
    public IDictionary<string, object?>? ContextoAdicional { get; set; }

    public bool EhAcao(string acao) => string.Equals(Acao, acao, StringComparison.OrdinalIgnoreCase);

    public static class Acoes
    {
        public const string ConfirmarReserva = "confirmar_reserva";
        public const string ConsultarReserva = "consultar_reserva";
        public const string AtualizarReserva = "atualizar_reserva";
        public const string CancelarReserva = "cancelar_reserva";
    }
}
