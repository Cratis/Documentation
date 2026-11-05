---
title: Organization, workspace and namespace
description: "Cratis keeps organization, workspace and namespace apart. Learn what each term means, who owns it, and how Direct, Studio and a Stage application use them."
---

Cratis products use three words for three different things. An *organization* is the customer as a whole, such as Acme. A *workspace* is where people work inside one product. A *namespace* is where Chronicle stores one workspace's data. Each has one owner, and keeping them apart decides who can add members, who sets sign-in policy, and where data lives.

:::note[Available and planned]
Workspaces and namespaces exist in Cratis products today. A platform organization that spans products is **planned**; until it ships, each product's workspaces stand alone. Planned items are direction, not a delivery commitment; see the [roadmap](/roadmap/).
:::

## The three terms at a glance

| Term | What it is | Who owns it | What it holds | What it never does |
| --- | --- | --- | --- | --- |
| Organization | The customer as a whole, across Cratis products | Cratis platform organization administration (**Planned**), not any one product | Verified email domains, sign-in policies (for example "members sign in with our Microsoft Entra ID"), links to the customer's workspaces | Hold members or roles in a product |
| Workspace | Where people work inside one product. AuthProxy, Arc, Chronicle and Stage call it a *tenant* | The product | Members, roles and business data | Mean anything outside the product installation that created it |
| Namespace | The Chronicle partition that stores one workspace's events and read models | The product installation | That workspace's Chronicle data | Get chosen by, or shown to, the people using the product |

## Organization

An organization represents the customer for things that span products: verified email domains, sign-in policies, and links to the customer's workspaces in each product. Organizations and their links are **planned**.

Administering an organization does not make anyone a member of a workspace or give them a role in a product. Linking an organization to a workspace applies the organization's policies there; it never adds members. Products keep their own authorization checks.

## Workspace

The product creates workspaces and decides who belongs and with which role. Arc, AuthProxy and Chronicle call it a tenant and identify it by a tenant id.

When someone has more than one workspace, AuthProxy's [tenant selection page](/authproxy/configuration/tenant-selection/) shows the ones the product offers. Being listed or selected does not grant access: the product checks membership and roles on every request.

## Namespace

The product installation maps each workspace to a [Chronicle namespace](/chronicle/concepts/namespaces/), so one workspace's events, projections and read models stay apart from another's. With Arc's [Chronicle integration](/arc/backend/csharp/chronicle/tenancy/), the tenant id is the namespace name; see [Chronicle tenancy](/chronicle/tenancy/).

The namespace follows from the workspace, never the other way round. A request never chooses its namespace, and the namespace is not shown to the people using the product or used to work out which workspace a request belongs to.

Chronicle namespaces can also separate environments or domains. In Cratis products, one namespace holds one workspace's data.

## Who can change what

- Organization administrators manage the organization's domains, policies and links (**Planned**). That role is not workspace membership.
- Workspace administrators manage members and roles inside the product.
- The product installation decides which namespace each workspace uses. Nobody picks it at sign-in.

## Examples

### Direct

Direct schedules AI agents across the repositories of a GitHub organization. In this vocabulary, that GitHub organization's space in Direct is a **workspace**. Direct decides who belongs to it and who is a maintainer, for example who may approve a [runner](/direct/runner/). Direct keeps each workspace's data apart from the others', and you never see or pick where it is stored. A platform organization above it is planned.

### Studio

Each team that signs up for [Studio](/studio/) gets its own **workspace** with its event models. Studio decides who is a member and which roles they hold. A platform organization above it is planned.

### A Stage-rendered application

When someone signs up, or accepts an invitation to create a workspace, a Stage-rendered application creates the **workspace** (its tenant) and records its first member with a persona. Further members join by invitation. The application owns those members and personas. Its events go to the Chronicle **namespace** named after the tenant. See [onboarding rendering](/stage/reference/onboarding-rendering/).

## Words you will see elsewhere

- **Tenant** (AuthProxy, Arc, Chronicle, Stage) means a workspace.
- **Your organization**, in Direct and Studio screens and docs, currently means the workspace you work in. That is not the organization defined on this page.
- **Microsoft Entra ID tenant** is your identity provider's directory, not a Cratis workspace. Stage's [Entra ID guide](/stage/guides/sign-in-with-entra-id/) uses it this way.

## If you build a multi-tenant Cratis application

- Let people choose a workspace by its name. Never show or accept a namespace.
- Check membership in the product on every request. A selected workspace is not proof of membership. See [auth and compliance](/auth-and-compliance/).
- Do not derive a workspace from an organization, or an organization from a workspace.
- Keep the three identifiers apart in labels and in storage.
