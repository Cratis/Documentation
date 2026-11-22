---
title: Collect Cratis telemetry
description: Connect an application host and the Chronicle kernel to an OTLP receiver, inspect their signals, and prepare collection for production.
---

Connect your application and the Cratis Chronicle kernel to an OpenTelemetry Protocol (OTLP) receiver, then inspect each producer separately. This procedure uses a local receiver first; production collection needs additional controls described below.

You need a working Cratis application, access to its host configuration, and an OTLP receiver such as an Aspire dashboard or an OpenTelemetry Collector. If the application uses Chronicle, you also need access to the kernel's configuration. The examples below assume a receiver listening on **HTTP at `localhost:4318` using OTLP HTTP/protobuf**. Substitute your receiver's actual address and protocol.

:::caution[Keep the receiver private]
A local dashboard is a diagnostic tool, not a production telemetry backend. Keep it on a trusted development machine, restrict network exposure, and use test data. Do not expose an unauthenticated OTLP receiver or dashboard publicly.
:::

For names, privacy defaults and client differences, see the [observability reference](/observability/).

## 1. Choose a receiver and check its address

If you already use Aspire, open the dashboard from your AppHost and inspect its configured OTLP endpoint. Aspire can supply export settings to participating application services. **It does not automatically supply OTLP export settings to the Chronicle kernel container.**

For a new Aspire application, follow the [Cratis Aspire template guide](/templates/cratis-aspire/). Use the template's service-defaults setup rather than registering a second, competing telemetry provider. Otherwise, start an OTLP receiver using its maintained installation instructions before continuing.

Match the producer's protocol to the receiver:

| Protocol | Common receiver port | Endpoint shape |
| --- | --- | --- |
| OTLP gRPC | `4317` | Receiver address, without an HTTP signal path |
| OTLP HTTP/protobuf | `4318` | Base URL for global configuration; `/v1/traces`, `/v1/metrics`, or `/v1/logs` for signal-specific URLs |

These ports are conventions, not discovery. A dashboard can advertise different ports. For a containerized producer, `localhost` refers to that container, not your host or another collector container. Use an address reachable from each producer.

## 2. Enable the application host's SDK

Use the setup guide for the host that runs your application:

- **.NET:** install `Cratis.OpenTelemetry` and register `AddCratisOpenTelemetry` as described in [Fundamentals OpenTelemetry](/fundamentals/csharp/opentelemetry/). The helper subscribes to Cratis traces and meters and configures OpenTelemetry logging. The environment-variable configuration below follows `Cratis.OpenTelemetry` 7.34.3.
- **TypeScript:** initialize the Node SDK before importing the Chronicle client. Configure a context manager, propagator and exporters in the host; follow [TypeScript observability](/chronicle/clients/typescript/observability/).
- **Kotlin / Java:** configure the host OpenTelemetry SDK and the `io.cratis.chronicle` scope using [Kotlin tracing](/chronicle/clients/kotlin/guides/tracing/). Do not expect the .NET metric inventory.
- **Elixir:** follow [Elixir observability](/chronicle/clients/elixir/observability/) to configure the OpenTelemetry SDK and exporter. Native `:telemetry` measurements need an application-owned bridge if you want OTel metrics.

For a .NET application using the shared helper, set these variables in the shell that will launch the application, or in that application's launch environment:

```bash
export OTEL_SERVICE_NAME=library-api
export OTEL_RESOURCE_ATTRIBUTES=service.namespace=library,deployment.environment.name=development
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

Then start or restart the application with its normal run command. These settings select the receiver; they do not install an SDK into an application that has none. The helper adds the appropriate HTTP path for each signal. If you use a signal-specific endpoint instead, include its full path, for example `http://localhost:4318/v1/traces` for `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`.

Check for conflicting configuration: nonblank environment values override host configuration, and signal-specific settings override common fallbacks.

## 3. Configure the Chronicle kernel separately

Skip this step if your application does not use Chronicle. Set these variables in the kernel's process or container environment, separately from the application:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

Restart the kernel after changing its environment. Chronicle 19.181.2 registers each signal's exporter only when a common or corresponding signal-specific endpoint is configured. Do not put an `OpenTelemetry.OtlpEndpoint` section in `chronicle.json`: kernel producer settings and SDK exporter settings are separate.

Use a receiver address reachable **from the kernel**. A containerized kernel usually cannot use the same localhost address as an application running directly on your machine. For an Aspire-managed kernel, supply OTLP environment variables to the container explicitly; application service defaults alone are insufficient. See the [kernel configuration reference](/chronicle/hosting/configuration/open-telemetry/) for producer options.

The application should appear under `library-api` and the kernel under `Chronicle` unless you override their resource names. Seeing only one resource is a reason to check that producer's configuration, not to reinstall instrumentation in the other.

## 4. Generate and inspect a small operation

Use test data and perform one operation your application already supports: execute a command, query a read model, or append an event. If there is a reactor or reducer, let it process the event too. Allow time for batched export, then inspect:

1. **Traces:** select the application resource. For Arc .NET, look for command or query spans such as `cratis.arc.command.execute` or `cratis.arc.query.perform`. For a Chronicle client, use the names in its product reference; Kotlin uses a different naming scheme.
2. **Metrics:** look for the corresponding counter or duration distribution after an instrumented operation. A registered meter with no measurements is not evidence of an exporter failure. The .NET client in Chronicle 19.181.2 has no client meters; Elixir emits native telemetry events and Kotlin supplies tracing. None should be expected to reproduce the kernel's metric set.
3. **Logs:** inspect an application log emitted during the operation. Where the host supports it, use its trace/span IDs or correlation ID to find related activity. Check that test payloads, credentials and identity claims did not enter telemetry.
4. **Kernel:** select `Chronicle` separately and check for server-side activity. Do not expect a single continuous trace from append through later asynchronous observer processing: durable trace context is not currently guaranteed. Use the correlation ID to locate related work.

### If a signal is missing

| Symptom | Check first |
| --- | --- |
| Nothing arrives | Receiver is running; endpoint is reachable from the producer; protocol and port agree; SDK/exporter was installed before operations ran. |
| Application arrives, kernel does not | OTLP endpoint variables in the kernel environment and container networking. Application OTLP variables do not establish kernel export. |
| Kernel arrives, application does not | Host SDK registration, endpoint selection and scope subscriptions. |
| Metrics/logs arrive but traces do not | Host sampling policy, scope subscription, and whether the operation actually creates a span. |
| HTTP export reports a missing route | A signal-specific endpoint may be missing `/v1/traces`, `/v1/metrics`, or `/v1/logs`; verify the receiver's HTTP routes. |
| A client has no expected metric | Compare that client's supported signals and installed version, not another language's inventory. |
| Append and reactor are separate traces | This can be the expected asynchronous boundary; correlation IDs and trace IDs have different purposes. |

## 5. Move collection to production

Keep instrumentation in the application, but replace local dashboard settings with your deployment's receiver configuration. An OpenTelemetry Collector can receive OTLP and forward it to your chosen backends. Cratis does not require a particular vendor.

Before rollout:

- **Protect transport and access.** Use TLS and receiver authentication where required. Supply exporter credentials through your deployment's secret mechanism, not committed configuration or telemetry attributes.
- **Separate services and environments.** Keep service names stable and attach deployment/version resource attributes. Confirm that each producer reaches the intended collector rather than a developer endpoint.
- **Control data before export.** Choose event-source ID handling for each client explicitly, review exception/log contents, and remove payloads and identity data. Never use event-source or correlation IDs as metric labels.
- **Set sampling and retention deliberately.** Choose a trace sampling policy for the workload; give logs, traces and metrics appropriate retention and access policies. Validate both successful and failed operations.
- **Plan for receiver failure.** Configure and monitor collector queues, retry behavior, memory limits and dropped data. Do not assume library instrumentation guarantees durable telemetry delivery.
- **Verify the deployed route.** Repeat the small-operation check against the production collection path with approved non-sensitive test data, including kernel and application resources separately.

Receiver deployment, backend storage, retention and operational monitoring remain your responsibility. Continue with [production readiness](/production-readiness/) for the broader application checklist.
