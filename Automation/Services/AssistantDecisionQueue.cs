using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Automation.Dtos;

namespace Automation.Services;

public class AssistantDecisionQueue
{
    private readonly Channel<AssistantDecision> _channel;

    public AssistantDecisionQueue()
    {
        var options = new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        };
        _channel = Channel.CreateUnbounded<AssistantDecision>(options);
    }

    public ValueTask QueueAsync(AssistantDecision decisao, CancellationToken cancellationToken = default)
    {
        if (!_channel.Writer.TryWrite(decisao))
        {
            return _channel.Writer.WriteAsync(decisao, cancellationToken);
        }

        return ValueTask.CompletedTask;
    }

    public IAsyncEnumerable<AssistantDecision> ReadAllAsync(CancellationToken cancellationToken)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }
}
