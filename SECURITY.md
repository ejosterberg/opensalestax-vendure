# Security Policy

## Reporting a vulnerability

Email **ejosterberg@gmail.com** with subject line starting
`[opensalestax-vendure] security:`. Include affected version,
reproduction steps, and impact. Do not open a public GitHub
issue for security reports.

Acknowledgement target: 7 days. Critical issues (tax-correctness
or merchant-data access): mark `[critical]` in subject, expect
faster turnaround.

## Supported versions

Latest minor on `main`. Older releases are not back-patched.

## Threat model

This plugin runs in-process inside the merchant's Vendure
server. It exposes **no inbound HTTP routes, no GraphQL
resolvers, no webhook receivers**. The trust boundary is the
merchant's own Vendure host; whatever code loaded the plugin
is already trusted.

Plugin configuration comes from two trusted sources:

1. `OpenSalesTaxPlugin.init({...})` arguments in the merchant's
   `vendure-config.ts`
2. `process.env` (merchant-controlled)

Both are validated at construction time (URL parse, scheme
allowlist `http:`/`https:`). The plugin's outbound calls go
only to the configured OST engine URL.

If you find a path that violates these guarantees, please
report it via the email above.
