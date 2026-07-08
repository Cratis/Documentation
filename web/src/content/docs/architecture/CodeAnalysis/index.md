---
title: Code Analysis
---

Cratis Architecture ships Roslyn analyzers that enforce architectural and coding conventions across Cratis codebases.

## Goals

- Keep architectural intent enforceable
- Surface violations as early as possible
- Give developers and agents clear, actionable feedback

## Rules Overview

| Rule ID | Title | Severity | Description |
|---|---|---|---|
| [CRARCH0001](/architecture/codeanalysis/rules/crarch0001-exception-type-naming/) | Exception type naming | Warning | Exception types must use domain terminology and avoid the generic Exception suffix |
| [CRARCH0002](/architecture/codeanalysis/rules/crarch0002-no-built-in-exception-types/) | No built-in exception types | Warning | Throwing framework exceptions hides domain intent |
| [CRARCH0003](/architecture/codeanalysis/rules/crarch0003-no-postfixes-on-class-names/) | No postfixes on class names | Warning | Class names must describe domain concepts, not technical roles |
| [CRARCH0004](/architecture/codeanalysis/rules/crarch0004-no-features-in-namespace/) | No Features in namespace | Warning | Namespace paths should stay domain-oriented and avoid framework-driven structure names |
| [CRARCH0005](/architecture/codeanalysis/rules/crarch0005-no-regions/) | No regions | Warning | Region directives usually indicate files that need better separation of responsibilities |
| [CRARCH0006](/architecture/codeanalysis/rules/crarch0006-logging-via-loggermessage/) | Logging via LoggerMessage | Warning | Structured, source-generated logging ensures consistency and better performance |
| [CRARCH0007](/architecture/codeanalysis/rules/crarch0007-no-iserviceprovider-injection/) | No IServiceProvider injection | Warning | Service locator patterns hide dependencies and make code harder to reason about |
| [CRARCH0008](/architecture/codeanalysis/rules/crarch0008-use-is-null-checks/) | Use is null checks | Warning | Pattern matching null checks are the preferred and consistent style |
| [CRARCH0009](/architecture/codeanalysis/rules/crarch0009-use-string-interpolation/) | Use string interpolation | Warning | Interpolated strings are clearer and easier to maintain |
| [CRARCH0010](/architecture/codeanalysis/rules/crarch0010-constructor-fan-out/) | Constructor fan-out | Warning | Too many dependencies indicate excessive responsibility in one type |
| [CRARCH0011](/architecture/codeanalysis/rules/crarch0011-file-length-threshold/) | File length threshold | Warning | Very large files are difficult to understand and maintain |
| [CRARCH0012](/architecture/codeanalysis/rules/crarch0012-async-void-forbidden/) | async void forbidden | Error | async void methods hide failures and cannot be awaited in regular flows |
| [CRARCH0013](/architecture/codeanalysis/rules/crarch0013-no-blocking-on-async/) | No blocking on async | Warning | Blocking asynchronous calls can cause deadlocks and reliability issues |
| [CRARCH0014](/architecture/codeanalysis/rules/crarch0014-no-test-types-in-production/) | No test types in production | Error | Production assemblies must remain independent of test-only infrastructure |
| [CRARCH0015](/architecture/codeanalysis/rules/crarch0015-static-class-naming-convention/) | Static class naming convention | Warning | Static utility types follow strict naming conventions to improve discoverability |
| [CRARCH0016](/architecture/codeanalysis/rules/crarch0016-unused-interfaces/) | Unused interfaces | Warning | Speculative interfaces without implementations add unnecessary abstraction |
| [CRARCH0017](/architecture/codeanalysis/rules/crarch0017-namespace-must-align-with-folder-path/) | Namespace must align with folder path | Warning | Namespace and folder alignment improves navigability and consistency |
| [CRARCH0018](/architecture/codeanalysis/rules/crarch0018-avoid-concrete-type-injection/) | Avoid concrete type injection | Warning | Constructor dependencies should favor abstractions for loose coupling |
| [CRARCH0019](/architecture/codeanalysis/rules/crarch0019-avoid-async-postfix-on-method-names/) | Avoid Async postfix on method names | Warning | Method names should avoid unnecessary suffixes unless sync/async pairs exist |
| [CRARCH0020](/architecture/codeanalysis/rules/crarch0020-handle-asynchronous-calls/) | Handle asynchronous calls | Warning | Fire-and-forget calls can hide failures and produce nondeterministic behavior |
| [CRARCH0021](/architecture/codeanalysis/rules/crarch0021-serializable-attribute-not-allowed/) | Serializable attribute not allowed | Warning | Legacy serialization attributes are not part of modern Cratis architecture guidance |
| [CRARCH0022](/architecture/codeanalysis/rules/crarch0022-private-modifier-not-allowed/) | Private modifier not allowed | Warning | Private is implicit in C#, so explicit modifiers add noise |
| [CRARCH0023](/architecture/codeanalysis/rules/crarch0023-use-typed-logger-category/) | Use typed logger category | Warning | Typed logger categories align log events with the producing type |
| [CRARCH0024](/architecture/codeanalysis/rules/crarch0024-loggermessage-container-conventions/) | LoggerMessage container conventions | Warning | LoggerMessage methods must live in convention-based containers for consistency |
| [CRARCH0025](/architecture/codeanalysis/rules/crarch0025-use-cratis-fundamentals-traces/) | Use Cratis Fundamentals traces | Warning | Tracing should flow through Cratis Fundamentals abstractions for consistency |
| [CRARCH0026](/architecture/codeanalysis/rules/crarch0026-use-cratis-fundamentals-metrics/) | Use Cratis Fundamentals metrics | Warning | Metrics should use Cratis Fundamentals abstractions instead of raw instrument creation |
