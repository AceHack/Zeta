using Microsoft.Extensions.DependencyInjection;

namespace Zeta.Mediator;

/// <summary>Registration for the Zeta.Mediator port adapter.</summary>
public static class ZetaMediatorServiceCollectionExtensions
{
    /// <summary>
    /// Register the <see cref="IMediator"/> port over the generated martinothamar/Mediator
    /// implementation. Call this AFTER the generated <c>services.AddMediator()</c> in the edge
    /// (composition-root) assembly, which registers <c>global::Mediator.IMediator</c>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddZetaMediatorAdapter(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddSingleton<IMediator>(static sp => new ZetaMediator(sp.GetRequiredService<global::Mediator.IMediator>()));
        services.AddSingleton<ISender>(static sp => sp.GetRequiredService<IMediator>());
        services.AddSingleton<IPublisher>(static sp => sp.GetRequiredService<IMediator>());
        return services;
    }
}
