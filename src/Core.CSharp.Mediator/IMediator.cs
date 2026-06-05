namespace Zeta.Mediator;

/// <summary>The mediator port: the single dependency business code injects to send and publish.</summary>
public interface IMediator : ISender, IPublisher;
