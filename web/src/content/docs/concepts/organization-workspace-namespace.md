---
title: Organization, workspace and namespace
description: "Distinguish Studio organizations, product workspaces and Chronicle namespaces from the planned cross-product Identity contract."
---

The meaning of *organization* and *workspace* depends on the product. Studio's organization owns people and projects. In the shared Identity contract, a platform organization holds cross-product policy, while a product workspace owns membership. A Chronicle namespace partitions data within an event store. Keeping these meanings apart helps you distinguish who grants access from where data is stored.

:::note[Available and planned]
Studio's organization and Chronicle's namespaces are existing product concepts. The cross-product platform organization is **planned**. The [Identity tenant-model contract](https://github.com/Cratis/Identity/blob/e70b6d48a2df7c76fa8147166d33c3299fb0cd2c/Documentation/specs/identity-tenant-model-v1.md) defines ownership and authorization requirements; it does not claim deployed behavior or a migration of Studio's organization. Planned items are direction, not a delivery commitment; see the [roadmap](/roadmap/).
:::

## The three terms at a glance

| Term | Meaning in this context | Ownership boundary |
| --- | --- | --- |
| Organization in Studio | The team's scope for people, projects, AI setup, integrations and billing | Studio manages its own members and roles |
| Platform organization (**Planned**) | The customer's cross-product policy scope: verified domains, sign-in policies and confirmed tenant links | Under the Identity contract, organization administration does not grant product membership |
| Product workspace | The product-facing name for a tenant in the Identity contract, not a second identifier | The product owns membership, roles and business data; tenant identity is scoped to a resource and installation |
| Chronicle namespace | A named isolation partition within an event store | The product installation owns the tenant-to-namespace mapping; a storage partition does not authorize a caller |

## Organization

In [Studio](/studio/), an organization is the team's existing product scope. It contains members and projects and owns settings such as AI setup, integrations and billing. This is the organization named in Studio's screens and [glossary](/studio/reference/glossary/#organization).

The **planned platform organization** has a different responsibility: verified email domains, sign-in policies and confirmed links to product tenants. Under the Identity contract, administering this organization does not make anyone a product member or give them a product role. A confirmed link applies organization policy without adding members; products must keep their own authorization checks.

These meanings coexist. The contract does not establish a rename or migration of Studio's organization, nor does this vocabulary make a platform organization a prerequisite for standalone products. Identity specifications use the spelling *organisation*; preserve that spelling wherever it is part of an exact contract or wire name.

## Workspace

In the shared Identity contract, *workspace* is the product-facing name for a tenant. The product creates the tenant and owns membership and roles. The tenant id belongs to that product's resource and installation; it is not a global customer identifier. This terminology does not replace each product's existing labels.

AuthProxy's [tenant selection page](/authproxy/configuration/tenant-selection/) shows the tenants the product offers. Under the contract, being listed or selected must not grant access: the product must check live membership and roles on every request.

A **Screenplay workspace file** means something else. It packages a model application and its release baseline for rendering. It is not a customer tenant, a membership list or a Chronicle namespace.

## Namespace

A [Chronicle namespace](/chronicle/concepts/namespaces/) isolates events, observer progress and namespace read-model data **within an event store**. One namespace per tenant is a common pattern. A namespace name alone does not identify a customer across event stores, product installations or environments, and storage isolation does not grant access.

With Arc's [Chronicle integration](/arc/backend/csharp/chronicle/tenancy/), the current tenant id supplies the namespace name; the default tenant maps to Chronicle's `Default` namespace. This is a specific resolver behavior, not a universal cross-product registry. See [Chronicle tenancy](/chronicle/tenancy/).

The Identity contract requires the installation's registered mapping to select the namespace from the verified tenant. Resource, installation and environment identify the requested target alongside the tenant. A namespace must not be accepted from caller input or used to infer a tenant under that contract. These are application authorization requirements, not restrictions on Chronicle's administrative namespace-selection tools.

Chronicle namespaces can also separate environments or domains. An environment label does not automatically create a namespace or establish a tenant mapping. For storage operations, see [managing namespaces](/chronicle/namespaces/).

## Who can change what

Under the shared Identity contract:

- Platform organization administrators manage domains, policies and confirmed links (**Planned**). That role is not product membership.
- Tenant administrators manage members and roles inside the product.
- The product installation owns namespace resolution. A person selects a product workspace at sign-in, not its storage namespace.

## Examples

### Direct

Direct schedules AI agents across the repositories of a GitHub organization. In this vocabulary, that GitHub organization's space in Direct is a **workspace**. Direct decides who belongs to it and who is a maintainer, for example who may approve a [runner](/direct/runner/). Direct keeps each workspace's data apart from the others', and you never see or pick where it is stored. A platform organization above it is planned.

### Studio

[Studio](/studio/) calls its team scope an **organization**. Its projects group applications, and those applications contain the domains and event models the team works on. Studio owns organization membership and roles. Calling this scope a product workspace in a cross-product discussion must not imply that Studio has renamed it or adopted a platform-organization migration.

### A Stage-rendered application

When someone signs up, or accepts an invitation to create a workspace, a Stage-rendered application creates the **workspace** (its tenant) and records its first member with a persona. Further members join by invitation. The application owns those members and personas. Its events go to the Chronicle **namespace** named after the tenant. See [onboarding rendering](/stage/reference/onboarding-rendering/).

## Words you will see elsewhere

- **Tenant** means the product's group and data scope; *workspace* is its product-facing name in the shared Identity contract.
- **Your organization** in Studio means Studio's member-owning organization, not the planned platform policy scope. Keep the product qualifier when comparing them.
- **Screenplay workspace file** describes a model package, not product tenancy.
- **C# namespace** and **Kubernetes namespace** are unrelated to Chronicle storage namespaces.
- **Project**, **application**, **environment**, **cluster** and **CLI context** describe other product or deployment scopes. See the [glossary](/glossary/#product-and-deployment-scopes); they do not form a single cross-product hierarchy.
- **Microsoft Entra ID tenant** is your identity provider's directory, not a Cratis workspace. Stage's [Entra ID guide](/stage/guides/sign-in-with-entra-id/) uses it this way.

## If you build a multi-tenant Cratis application

For an application adopting the shared Identity contract:

- Let people choose a product workspace by its name. Resolve its storage namespace inside the application rather than accepting a namespace from the caller.
- Check live membership and roles in the product on every request. A selected workspace is not proof of membership. See [auth and compliance](/auth-and-compliance/).
- Do not derive a tenant from a platform organization, or a platform organization from a tenant.
- Keep organization identity, tenant identity and namespace names distinct in labels and storage, even when a particular resolver uses the tenant id as the namespace name.
