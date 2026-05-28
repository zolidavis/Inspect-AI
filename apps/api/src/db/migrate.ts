/**
 * Standalone migration runner. Use `pnpm db:migrate` to apply pending
 * migrations without booting the API server (useful in CI / before
 * deploy). The same migration runs automatically on API startup via
 * ./client.ts.
 */
import "./client.js";
console.log("✓ migrations applied");
