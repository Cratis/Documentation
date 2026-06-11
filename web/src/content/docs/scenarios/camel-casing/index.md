# Configure camel casing for Chronicle and MongoDB

This how-to shows how to configure camel casing when you use the Cratis meta package setup in an ASP.NET Core app.

## Goal

Configure both Chronicle and Arc MongoDB so projection/read-model data uses camelCase names consistently.

## Prerequisites

- You already have an ASP.NET Core app using the Cratis meta package setup (`UseCratisArc()`).
- You already reference Chronicle and Arc MongoDB integration packages.

## 1. Start from your Cratis meta package setup

In `Program.cs`, keep your existing Cratis setup and then add Chronicle and MongoDB camel case configuration:

```csharp
var builder = WebApplication.CreateBuilder(args)
    .UseCratisArc();

builder.AddCratisChronicle(
    configure: chronicleBuilder => chronicleBuilder.WithCamelCaseNamingPolicy());

builder.UseCratisMongoDB(configureMongoDB: mongoBuilder =>
    mongoBuilder.WithCamelCaseNamingPolicy());

var app = builder.Build();
app.UseCratisChronicle();
```

## 2. What this gives you

With this setup:

- Chronicle builds projection definitions using camelCase naming.
- MongoDB stores document field names as camelCase.
- Your read-model persistence naming stays consistent across Chronicle and Arc MongoDB.

For example, a C# property such as `EmailAddress` is persisted as `emailAddress`.

## 3. Verify in MongoDB

After your app runs and projections update read models, inspect the stored documents. You should see camelCase fields.

## Related reference pages

- [Chronicle camel casing](https://www.cratis.io/docs/Chronicle/configuration/camel-casing.html)
- [Arc MongoDB naming policies](https://www.cratis.io/docs/Arc/backend/mongodb/naming-policies.html)
