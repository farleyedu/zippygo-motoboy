using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Automation.Dtos;
using Automation.Models;
using Microsoft.Extensions.Logging;

namespace Automation.Services;

public class ToolExecutorService
{
    private static readonly string[] ValoresInvalidos =
    {
        "não informada", "nao informada", "não informado", "nao informado", "a definir", "a combinar", "undefined", "null", "string"
    };

    private const string TentativaReservaContextKey = "tentativa_reserva";
    private const string DecisaoConflitoContextKey = "decisao_reserva_conflito";

    private readonly ReservaService _reservaService;
    private readonly ConversationContextService _contextService;
    private readonly ILogger<ToolExecutorService> _logger;

    public ToolExecutorService(ReservaService reservaService, ConversationContextService contextService, ILogger<ToolExecutorService> logger)
    {
        _reservaService = reservaService;
        _contextService = contextService;
        _logger = logger;
    }

    private static readonly JsonElement ConsultarReservaSchema = JsonSerializer.Deserialize<JsonElement>(@"{
        \"type\": \"object\",
        \"properties\": {
            \"idConversa\": { \"type\": \"string\", \"format\": \"uuid\" },
            \"codigoReserva\": { \"type\": \"string\" }
        },
        \"required\": [\"idConversa\"]
    }")!;

    private static readonly JsonElement AtualizarReservaSchema = JsonSerializer.Deserialize<JsonElement>(@"{
        \"type\": \"object\",
        \"properties\": {
            \"idConversa\": { \"type\": \"string\", \"format\": \"uuid\" },
            \"codigoReserva\": { \"type\": \"string\" },
            \"novaHora\": { \"type\": \"string\", \"pattern\": \"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$\" },
            \"novaQtd\": { \"type\": \"integer\", \"minimum\": 1 }
        },
        \"required\": [\"idConversa\"]
    }")!;

    public IReadOnlyList<ToolDefinition> GetDeclaredTools()
    {
        return new List<ToolDefinition>
        {
            new("consultar_reserva", "Consulta reservas existentes", ConsultarReservaSchema),
            new("atualizar_reserva", "Atualiza reserva existente", AtualizarReservaSchema)
        };
    }

    public async Task<ToolExecutionResult> HandleConfirmarReservaAsync(AssistantDecision decisao, CancellationToken cancellationToken = default)
    {
        var mensagemNome = ValidarCampo(decisao.NomeCliente, "o nome do responsável pela reserva");
        if (mensagemNome is not null)
        {
            _logger.LogWarning("WRN-TOOL-CONFIRMAR-NOME-INVALIDO");
            return ToolExecutionResult.Falha(mensagemNome);
        }

        var mensagemQtd = ValidarCampo(decisao.QuantidadePessoas?.ToString(), "a quantidade de pessoas");
        if (mensagemQtd is not null)
        {
            _logger.LogWarning("WRN-TOOL-CONFIRMAR-QTD-INVALIDA");
            return ToolExecutionResult.Falha(mensagemQtd);
        }

        var mensagemData = ValidarCampo(decisao.Data?.ToString("yyyy-MM-dd"), "a data da reserva");
        if (mensagemData is not null)
        {
            _logger.LogWarning("WRN-TOOL-CONFIRMAR-DATA-INVALIDA");
            return ToolExecutionResult.Falha(mensagemData);
        }
        if (decisao.Hora is null)
        {
            if (decisao.ContextoAdicional != null && decisao.ContextoAdicional.TryGetValue("hora", out var horaObj))
            {
                var horaString = horaObj?.ToString();
                if (!TryParseHora(horaString, out var horaValida))
                {
                    return ToolExecutionResult.Falha("Qual horário você deseja? Pode informar no formato HH:mm, por exemplo 19:00.");
                }

                decisao.Hora = horaValida;
            }
            else
            {
                return ToolExecutionResult.Falha("Qual horário você deseja? Pode informar no formato HH:mm, por exemplo 19:00.");
            }
        }

        if (decisao.IdConversa.HasValue)
        {
            var snapshot = new TentativaReservaSnapshotDto
            {
                NomeCliente = decisao.NomeCliente,
                QuantidadePessoas = decisao.QuantidadePessoas,
                Data = decisao.Data,
                Hora = decisao.Hora
            };
            await _contextService.SalvarAsync(decisao.IdConversa.Value, TentativaReservaContextKey, snapshot, TimeSpan.FromHours(2), cancellationToken);
        }

        if (decisao.IdCliente.HasValue && decisao.IdEstabelecimento.HasValue && decisao.Data.HasValue)
        {
            var existeConflito = await _reservaService.ExisteConflitoMesmoDiaAsync(decisao.IdCliente.Value, decisao.IdEstabelecimento.Value, decisao.Data.Value, cancellationToken);
            if (existeConflito)
            {
                _logger.LogInformation("INF-TOOL-CONFIRMAR-RESERVA-CONFLITO {@Cliente} {@Dia}", decisao.IdCliente, decisao.Data);
                Reserva? reservaConflitante = null;
                var reservas = await _reservaService.ObterReservasAtivasDoClienteAsync(decisao.IdCliente.Value, decisao.IdEstabelecimento.Value, decisao.Data.Value, cancellationToken);
                reservaConflitante = _reservaService.SelecionarReservaMesmoDia(reservas, decisao.Data.Value);
                if (decisao.IdConversa.HasValue)
                {
                    await _contextService.SalvarAsync(decisao.IdConversa.Value, DecisaoConflitoContextKey, new
                    {
                        ReservaId = reservaConflitante?.Id,
                        Codigo = reservaConflitante?.CodigoFormatado
                    }, TimeSpan.FromHours(2), cancellationToken);
                }

                var resumo = reservaConflitante != null ? _reservaService.MontarResumoReserva(reservaConflitante) : string.Empty;
                var mensagem = $"Você já possui uma reserva confirmada para este dia:\n{resumo}\n\nO que você prefere?\n1) Atualizar esta reserva\n2) Cancelar e criar nova\n3) Manter como está";
                return ToolExecutionResult.Falha(mensagem);
            }
        }

        _logger.LogInformation("INF-TOOL-CONFIRMAR-RESERVA-SUCESSO {@Cliente}", decisao.IdCliente);
        return ToolExecutionResult.Sucesso("Reserva confirmada com sucesso.");
    }

    public async Task<ToolExecutionResult> HandleConsultarReservaAsync(AssistantDecision decisao, CancellationToken cancellationToken = default)
    {
        if (decisao.IdConversa is null)
        {
            return ToolExecutionResult.Falha("Não consegui localizar sua conversa. Pode tentar novamente?");
        }

        if (!string.IsNullOrWhiteSpace(decisao.CodigoReserva))
        {
            var reserva = await _reservaService.ObterReservaPorCodigoAsync(decisao.CodigoReserva, cancellationToken);
            if (reserva is null)
            {
                return ToolExecutionResult.Falha("Não encontrei nenhuma reserva com esse código. Pode conferir?");
            }

            var resumo = _reservaService.MontarResumoReserva(reserva);
            return ToolExecutionResult.Sucesso($"Aqui estão os detalhes da sua reserva {reserva.CodigoFormatado}:\n{resumo}");
        }

        if (decisao.IdCliente is null || decisao.IdEstabelecimento is null)
        {
            return ToolExecutionResult.Falha("Para consultar sem código preciso confirmar quem é você. Pode me informar seu nome ou documento cadastrado?");
        }

        var reservas = await _reservaService.ObterReservasAtivasDoClienteAsync(decisao.IdCliente.Value, decisao.IdEstabelecimento.Value, DateTime.UtcNow, cancellationToken);
        if (reservas.Count == 0)
        {
            return ToolExecutionResult.Sucesso("Não encontrei reservas futuras ativas para você.");
        }

        var linhas = reservas.Select(r => $"• {r.CodigoFormatado} — {r.Data:dd/MM/yyyy} às {r.Hora:hh\\:mm} para {r.QuantidadePessoas} pessoas").ToArray();
        var mensagem = "Estas são as suas próximas reservas:\n" + string.Join('\n', linhas) + "\nSe quiser detalhes de alguma delas, é só me informar o código.";
        return ToolExecutionResult.Sucesso(mensagem);
    }

    public async Task<ToolExecutionResult> HandleAtualizarReservaAsync(AssistantDecision decisao, CancellationToken cancellationToken = default)
    {
        if (decisao.IdConversa is null)
        {
            return ToolExecutionResult.Falha("Não consegui identificar a conversa para atualizar a reserva.");
        }

        var contexto = await _contextService.LerAsync<JsonElement>(decisao.IdConversa.Value, DecisaoConflitoContextKey, cancellationToken);
        Guid? reservaId = null;
        string? codigoReserva = decisao.CodigoReserva;
        if (contexto.ValueKind != JsonValueKind.Undefined && contexto.TryGetProperty("ReservaId", out var reservaIdProp) && reservaIdProp.ValueKind == JsonValueKind.String && Guid.TryParse(reservaIdProp.GetString(), out var parsed))
        {
            reservaId = parsed;
        }
        else if (contexto.ValueKind != JsonValueKind.Undefined && contexto.TryGetProperty("Codigo", out var codigoProp))
        {
            codigoReserva = codigoProp.GetString();
        }

        if (!string.IsNullOrWhiteSpace(codigoReserva) && reservaId is null)
        {
            var reserva = await _reservaService.ObterReservaPorCodigoAsync(codigoReserva!, cancellationToken);
            reservaId = reserva?.Id;
            if (reserva is not null)
            {
                decisao.IdEstabelecimento ??= reserva.IdEstabelecimento;
                decisao.IdCliente ??= reserva.IdCliente;
                decisao.Data ??= reserva.Data;
            }
        }

        if (reservaId is null)
        {
            return ToolExecutionResult.Falha("Preciso saber qual reserva deseja atualizar. Pode me informar o código?");
        }

        if (decisao.IdEstabelecimento is null || decisao.Data is null)
        {
            return ToolExecutionResult.Falha("Ainda preciso confirmar para qual data e estabelecimento é a reserva antes de atualizar.");
        }

        if (decisao.QuantidadePessoas is null)
        {
            return ToolExecutionResult.Falha("Quantas pessoas irão após a atualização?");
        }

        if (!decisao.Hora.HasValue)
        {
            return ToolExecutionResult.Falha("Qual será o novo horário? Informe no formato HH:mm, por exemplo 20:30.");
        }

        var sucesso = await _reservaService.AtualizarReservaComCapacidadeAsync(reservaId.Value, decisao.IdEstabelecimento.Value, decisao.Data.Value, decisao.Hora.Value, decisao.QuantidadePessoas.Value, cancellationToken);
        if (!sucesso)
        {
            return ToolExecutionResult.Falha("Não tenho disponibilidade para esse horário ou quantidade. Pode sugerir outro?");
        }

        await _contextService.RemoverAsync(decisao.IdConversa.Value, DecisaoConflitoContextKey, cancellationToken);
        await _contextService.RemoverAsync(decisao.IdConversa.Value, TentativaReservaContextKey, cancellationToken);

        var horaFormatada = decisao.Hora.Value.ToString("hh\\:mm");
        var dataFormatada = decisao.Data?.ToString("dd/MM/yyyy") ?? "data combinada";
        var mensagem = $"Tudo certo! Atualizei sua reserva para {dataFormatada} às {horaFormatada} para {decisao.QuantidadePessoas} pessoas.";
        return ToolExecutionResult.Sucesso(mensagem);
    }

    private static string? ValidarCampo(string? valor, string nomeCampo)
    {
        if (string.IsNullOrWhiteSpace(valor))
        {
            return $"Não tenho {nomeCampo}. Pode me informar?";
        }

        var normalizado = valor.Trim().ToLowerInvariant();
        if (ValoresInvalidos.Any(v => string.Equals(normalizado, v, StringComparison.OrdinalIgnoreCase)))
        {
            return $"Recebi {nomeCampo} em branco ou como 'a definir'. Pode confirmar?";
        }
        return null;
    }

    private static bool TryParseHora(string? entrada, out TimeSpan hora)
    {
        hora = default;
        if (string.IsNullOrWhiteSpace(entrada))
        {
            return false;
        }

        entrada = entrada.Trim();
        if (ValoresInvalidos.Any(v => entrada.Equals(v, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        return TimeSpan.TryParseExact(entrada, "hh\\:mm", CultureInfo.InvariantCulture, out hora);
    }
}

public record ToolDefinition(string Name, string Description, JsonElement Schema);

public record ToolExecutionResult(bool Success, string Message)
{
    public static ToolExecutionResult Sucesso(string message) => new(true, message);
    public static ToolExecutionResult Falha(string message) => new(false, message);
}
