---
title: Observability in Cratis
description: Look up Cratis telemetry scopes, metrics, privacy boundaries, and export responsibilities across the application host and Chronicle kernel.
---

Cratis telemetry describes command, query, event-store, and observer operations through traces, metrics, and logs. **Your application and the Cratis Chronicle kernel are separate telemetry producers**: configuring one does not configure the other. Use [Collect telemetry](/collect-telemetry/) to connect them to a receiver.

This reference covers shared conventions and product differences. Product references own the detailed span, metric, and attribute inventories; names defined in a registry do not necessarily have an active recording site.

## Signals and ownership

| Signal | What it answers | Collection responsibility |
| --- | --- | --- |
| Traces | Which operations ran, how long they took, and which failures they encountered | The host installs an SDK, subscribes to instrumentation scopes, selects sampling, and exports spans. |
| Metrics | How often operations happen and how their duration or outcomes change | The host subscribes to meters and exports measurements. Not every client supplies meters. |
| Logs | What a component reported about an operation | The host configures logging providers, filtering, redaction, and export. Structured logs are not automatically exported by enabling traces. |

Cratis Fundamentals supplies shared .NET registration. Arc and Chronicle client libraries supply instrumentation; they do not choose your application's telemetry backend. The Chronicle kernel configures its own SDK and exporters.

## Instrumentation scopes and support

An instrumentation scope identifies a library. It is distinct from the resource attribute `service.name`, which identifies the running service.

| Producer | Scope | Behavior and version boundary |
| --- | --- | --- |
| Fundamentals .NET | `Cratis.*` subscription through the shared registration | `Cratis.OpenTelemetry` provides `AddCratisOpenTelemetry` and standard OTLP configuration. It is a registration helper, not an event-store meter. |
| Arc .NET | `Cratis.Arc` | Arc 23.15.0 supplies command, validator, query and observable-query spans and metrics; the application supplies the exporter. |
| Chronicle .NET client | `Cratis.Chronicle.Client` | Client append/observer traces; the application supplies the exporter. Chronicle 19.181.2 does not add client metrics. |
| Chronicle kernel | `Cratis.Chronicle` | Server event-sequence, observer, constraint and projection instrumentation; exporters are configured separately from clients. |
| Chronicle TypeScript | `Cratis.Chronicle.Client` | TypeScript 6.67.7 supplies traces, metrics, diagnostics and outgoing propagation. The host supplies SDK, context management and exporters. The scope changed from `@cratis/chronicle` in 6.34. |
| Chronicle Kotlin / Java | `io.cratis.chronicle` | The JVM client provides tracing, using host-supplied OpenTelemetry. Kotlin 7.13.0 does not provide the same built-in metric inventory as the .NET client. A `Cratis.*` subscription does not cover this scope. |
| Chronicle Elixir | `Cratis.Chronicle.Client` for OTel spans | Elixir 3.25.0 emits native `:telemetry` events, not built-in OTel metric instruments. The host supplies the OpenTelemetry SDK and exporter. |
| Chronicle Go | No built-in OTel scope in 0.18.0 | Application-level gRPC instrumentation is separate from Chronicle instrumentation. |
| Chronicle Python | No built-in OTel scope established | The client is experimental; do not assume telemetry parity with released clients. |

Dapr telemetry is unreleased work. Do not configure a released adapter on the assumption that planned spans and meters are already available. Wolverine has its own instrumentation scope, `Cratis.Chronicle.Wolverine`; check its package's instrumentation and release status before subscribing.

### Common names and units

The convention uses lowercase dotted operation names and duration measurements in **seconds**. Existing clients do not all implement that convention identically.

| Producer | Representative spans | Representative metrics |
| --- | --- | --- |
| Arc .NET | `cratis.arc.command.execute`, `cratis.arc.command.authorize`, `cratis.arc.query.perform`, `cratis.arc.query.push` | `cratis.arc.command.duration` (`s`), `cratis.arc.command.outcomes` (`{command}`), `cratis.arc.query.duration` (`s`), `cratis.arc.query.subscriptions` (`{subscription}`) |
| Chronicle .NET client | `client.event_sequence.append`, `client.reactor.handle` by default; convention mode uses the prefix `cratis.chronicle.client.` | No client meters in Chronicle 19.181.2 |
| Chronicle kernel | `cratis.chronicle.event_sequence.append`, `cratis.chronicle.observer.handle` | `cratis.chronicle.event_sequence.appended_events` (`{event}`, convention mode), `cratis.chronicle.event_sequence.append.duration` (`s`) |
| Chronicle TypeScript | Canonical dotted Chronicle operation names | `cratis.chronicle.event_sequence.batch_appends` (`{operation}`), `cratis.chronicle.event_sequence.append_many_duration` (`s`) |
| Chronicle Kotlin / Java | `Chronicle append <EventType>`, `Chronicle appendMany`, `Chronicle observe <EventType>` | No corresponding built-in meter inventory in Kotlin 7.13.0 |
| Chronicle Elixir | `cratis.chronicle.client.event_sequence.append`, `cratis.chronicle.client.reactor.handle`, `cratis.chronicle.client.reducer.reduce` | Native `:telemetry` events under `[:cratis, :chronicle, :client, ...]`; use the owning event's measurement units when building a metric bridge |

The TypeScript compatibility metrics API accepts legacy millisecond inputs and bridges canonical seconds. Do not convert those inputs twice or record the same measurement through both APIs. The kernel defaults to Legacy metric naming; Convention and Both are optional. Both exports two names for a measurement, not two measurements to sum. See the [name mappings](/chronicle/hosting/configuration/telemetry-names/). Some newer instruments are convention-only even in Legacy mode.

## Resource identity and export configuration

Set a stable `service.name` for each application and a `service.version` that identifies its deployment. The kernel's resource uses `service.name=Chronicle`. Distinguish environments with resource attributes rather than adding request-specific identifiers to every metric.

For .NET application hosts using `Cratis.OpenTelemetry` 7.34.3:

- `OTEL_SERVICE_NAME` supplies the application service name.
- `OTEL_RESOURCE_ATTRIBUTES` supplies comma-separated resource attributes.
- `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL` configure the shared destination and protocol.
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, and `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` override the destination for their signal. Corresponding signal-specific protocol and header settings are supported.
- With `http/protobuf`, a global endpoint gets `/v1/traces`, `/v1/metrics`, or `/v1/logs` appended. A signal-specific endpoint is used as supplied; include its full path.

Nonblank environment values override host configuration. Signal-specific settings take precedence over common fallbacks. When no endpoint is configured, the helper installs no OTLP exporter. It does not silently export to localhost.

The **kernel** also gates each exporter on the presence of a common or signal-specific OTLP endpoint. Set standard `OTEL_*` variables in the kernel process or container environment separately. Its `chronicle.json` `Telemetry` section controls producer behavior such as metric naming, identifier handling and optional Orleans/gRPC tracing; it is not an exporter endpoint section. See [kernel telemetry configuration](/chronicle/hosting/configuration/open-telemetry/).

### Sampling

Choose sampling in each producer's SDK. The shared .NET helper supports `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG`, with `parentbased_always_on` as its default. TypeScript, JVM and Elixir applications need their own SDK configuration. Do not assume an application's sampling settings are inherited by the kernel.

Sampling can omit spans while metrics and logs still arrive. For a bounded local check, use a sampler that records the test operations; select a production policy based on traffic, cost, and diagnostic needs. Sampling is not a substitute for removing sensitive fields.

## Correlation is not persisted trace context

Cratis correlation IDs join related operations and events at the application level. They are not W3C trace IDs. Current telemetry does **not** guarantee that appending an event creates a trace parent that is persisted and restored when a reactor or reducer handles that event later. Durable trace context is tracked in [Chronicle #4417](https://github.com/Cratis/Chronicle/issues/4417).

Where supported, outgoing calls propagate W3C trace context. Transport propagation is not evidence of a stored append-to-observer parent. Use the correlation ID to find related work when present; do not assume every client span carries it.

The TypeScript client permits only `cratis.correlation_id` in propagated baggage. Do not treat this as permission to place event-source IDs, identities or application payloads in baggage across the stack.

## Privacy and metric cardinality

Never send credentials, authentication headers, event payloads or personal data to a collector merely to make diagnosis easier. A collector and a dashboard receive operational data and need access controls and retention limits of their own.

The shared direction is **Raw / Hashed / Omitted** handling of opaque event-source IDs, with Raw as the amended convention default. That direction is not a universal shipped default:

- The Chronicle 19.181.2 kernel defaults to Hashed. Its implicit default can generate a process-lifetime key; explicitly choosing Hashed requires valid key configuration. Supply keys through deployment configuration, not checked-in JSON. See [identifier handling](/chronicle/hosting/configuration/telemetry-identifiers/).
- TypeScript omits event-source IDs by default and offers raw or HMAC modes.
- Kotlin 7.13.0 records its own `chronicle.*` attributes, including event-source IDs, and full exceptions. Do not assume the newer .NET redaction or naming rules apply.
- Elixir omits event-source IDs by default and offers explicit opt-in through `trace_event_source_id`.

Keep identifiers that identify people pseudonymous even when raw opaque IDs are allowed. Hashing makes an identifier stable and linkable; it does not remove the need for data protection.

**Event-source IDs, partition IDs and correlation IDs are not metric dimensions.** Use bounded operation dimensions such as outcome, transport and command/query type. Arc uses keys such as `cratis.arc.command.type`, `cratis.arc.command.outcome` and `cratis.arc.query.transport`; Chronicle convention keys include `cratis.event_store.name`, `cratis.event_store.namespace` and `cratis.event_sequence.id`. Avoid adding unbounded identifiers, payload values, batch sizes or exception messages as metric labels. Review event-store, namespace and event-type dimensions against the cardinality of your deployment too.

Arc's operation spans carry command/query context and correlation; exception events expose exception type rather than message or stack. That does not sanitize arbitrary application log messages or every third-party SDK exception. Kernel trace identifier shaping likewise does not guarantee log redaction.

## Product references

Use these inventories and setup guides for your installed product version:

- [Fundamentals OpenTelemetry registration](/fundamentals/csharp/opentelemetry/) — shared .NET SDK setup and OTLP configuration.
- [Arc .NET observability](/arc/backend/csharp/observability/) — command/query spans, metrics, structured scopes and redaction.
- [Chronicle client tracing](/chronicle/hosting/client-tracing/) — client operations and trace relationships.
- [Chronicle telemetry names](/chronicle/hosting/configuration/telemetry-names/) — legacy/convention mappings and metric dimensions.
- [Chronicle kernel OpenTelemetry](/chronicle/hosting/configuration/open-telemetry/) — server instrumentation and export.
- [Chronicle TypeScript observability](/chronicle/clients/typescript/observability/) — Node host setup, diagnostics and metric compatibility.
- [Chronicle Kotlin tracing](/chronicle/clients/kotlin/guides/tracing/) — JVM scope and SDK integration.
- [Chronicle Elixir observability](/chronicle/clients/elixir/observability/) — spans, native telemetry events and privacy options.
