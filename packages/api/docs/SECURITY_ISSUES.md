# Security Issues Tracking

This document tracks known security risks and their mitigation plans for the Devasign API.

## [HIGH] Stored XSS in `messages.content`

**Status**: 🔴 Open
**Date Identified**: 2026-02-19
**Reporter**: Security Review

### Description
The `content` field in the `messages` table stores user-provided text. This field is currently defined as a `text` type without any enforced server-side sanitization. When this content is fetched via the API and rendered in a browser or mobile web view without proper escaping/sanitization, it can lead to Stored Cross-Site Scripting (XSS).

### Impact
An attacker can send a message containing a malicious script (e.g., `<script>stealCookie()</script>`). When the recipient views the message, the script will execute in their session context, potentially leading to account takeover, sensitive data theft, or session hijacking.

### Mitigation Plan
1.  **Server-Side Sanitization**: Implement a middleware or utility function to sanitize the `content` field before it is inserted or updated in the database. A library like `dompurify` (running in a JSDOM environment) or a lightweight alternative should be used.
2.  **Output Encoding**: Ensure that all clients (mobile app, web) use safe rendering methods that automatically escape HTML or use a trusted sanitizer on the frontend.
3.  **Strict Content Security Policy (CSP)**: Implement a CSP to mitigate the impact of any missed XSS vectors.

### Blocking Status
This issue **blocks** the public exposure of any API endpoint that allows writing to or reading from the `messages` table until sanitization is implemented.
