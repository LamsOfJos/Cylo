# Agrocylo Pi Next scope

Updated: 2026-11-27

This document scopes the Pi Next version of Agrocylo. It separates the user-facing agricultural marketplace from the existing Stellar/Soroban implementation so that the Pi app does not carry a second blockchain stack into its authentication and checkout flows.

## Hackathon target

Build a mobile-friendly agricultural marketplace for Pi users: discover local farm products, contact sellers, place an order, and pay in Pi. Sign-in uses Pi Authentication. Payment confirmation and order fulfillment are controlled by the Agrocylo server after it verifies the Pi Platform API response.

Pi Next accepts Pi apps built through the Developer Web Console and SoloHost apps. For the Pi app submission, the current Pi Next page requires an English app name, compliant logo, accurate English description, preview images, PiNet integration, and a privacy policy. Submissions also need a public demo video (up to three minutes) that explains the app, its users and problem, its interface, and the Pi integration. The stated deadline is January 5, 2027 at 11:59 PM PST / January 6 at 07:59 UTC.

## Keep for the Pi app

- Marketplace browsing, farm and product listings, seller profiles, order history, messaging, and agricultural information that make the app useful to Pioneers.
- Existing API, database, image storage, and deployment pieces that support those user journeys.
- The existing server-side order and inventory rules, adapted so only a verified, completed Pi payment can mark a paid order as fulfilled.
- Pi SDK initialization in the web app; Pi Authentication with only the scopes the product uses; backend identity verification through `GET /me`.
- Pi User-to-App payments for buyer checkout. Keep the Pi Server API key on the backend. Verify the payment and its app/order metadata, approve and complete it server-side, and make callbacks idempotent.
- PiNet entry and links, Pi Browser and mobile layouts, and the Pi Next listing/submission assets.

## Leave out of the Pi Next runtime

These components are specific to the current Stellar/Soroban runtime and do not support the Pi marketplace checkout or Pi Authentication flow:

- Freighter and other Stellar wallet connection, wallet challenge signing, network-passphrase checks, and wallet handoff SSO.
- Stellar SDK transaction construction, XDR signing/submission, Soroban RPC calls, XLM fee estimation, and transaction recovery/indexing for the Pi checkout path.
- Stellar/Soroban contract deployment and operations: Rust contract workspaces, contract IDs, RPC watchers, event indexers, TTL keepers, and deployment/pause scripts.
- XLM-denominated payment labels and controls in the Pi app. Pi checkout amounts and order records must use Pi payment amounts and verified Pi payment identifiers.
- Stellar Wave bounty instructions and Stellar-specific onboarding in Pi Next-facing contributor material.

This is a runtime and submission cut list, not a request to erase the repository's historical Soroban implementation. Keep that code isolated from the Pi app while the product scope is migrated; remove it from the repository only after the marketplace has a complete Pi replacement and the remaining Stellar consumers have been checked.

## Defer until there is a Pi-specific design

- Campaign fundraising, investment baskets, investor returns, escrow, and governance. They currently depend on Soroban contract guarantees and cannot be represented as ordinary User-to-App checkout payments. Do not relabel them as Pi payments or treat a browser callback as proof of settlement.
- Pi subscriptions, ads, notifications, App-to-User payouts, and other native features. Pi Next asks for useful Pi integration; these are optional until a concrete user flow needs them.
- A second product backend or a rewrite of the marketplace. Reuse the existing product and order services where practical, and put Pi-specific identity/payment handling behind focused adapters.

## Integration rules

1. Initialize `window.Pi` with the SDK version and environment matching the registered app. Use the sandbox during development and switch to production only for the registered production app.
2. Treat the SDK's returned user object as display data. Send its access token to Agrocylo's server and validate it against Pi's `/me` endpoint before creating an app session.
3. Keep `PI_API_KEY` server-only. Use the user access token for user-scoped API calls and the server key for payment approval, lookup, and completion.
4. Persist a payment/order mapping before approval. Validate amount, app ownership, buyer, and order metadata against Agrocylo's database. Make repeated approval/completion calls safe; fulfill an order once, after server-confirmed completion.
5. Keep Pi Browser support and ordinary-browser/PiNet access in mind. The registered Pi app must satisfy PiNet integration and privacy-policy requirements independently of whether it is also hosted on a conventional domain.

## Official references

- [Pi developer documentation](https://developers.minepi.com/docs)
- [Build an app: authentication and payment flow](https://developers.minepi.com/docs/build-first-app/BuildAnApp)
- [Pi Authentication](https://developers.minepi.com/docs/authenticate-user/Authentication)
- [Pi Payments](https://developers.minepi.com/docs/accept-payment/Payments)
- [Pi Next Hackathon](https://developers.minepi.com/hackathon)
