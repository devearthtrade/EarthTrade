/**
 * Starts the local management API.
 *
 * Usage: node src/server/api/serve.ts [--port 4000]
 *
 * Local development only. See src/server/api/http.ts for why it has no
 * authentication and why it refuses to bind anywhere but loopback.
 */

import { buildRouter } from "./routes.ts";
import { createApi } from "./http.ts";
import { adminErrorPage } from "../admin/routes.ts";
import { close } from "../db/index.ts";
import { dbConfig } from "../db/config.ts";

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : Number(process.env.EARTHTRADE_API_PORT ?? 4000);

const cfg = dbConfig();
const api = createApi({ router: buildRouter(), port, errorPage: adminErrorPage });

const listening = await api.listen();

console.log(`EarthTrade management API`);
console.log(`  dashboard  http://127.0.0.1:${listening}/admin`);
console.log(`  api        http://127.0.0.1:${listening}/api`);
console.log(`  database   ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(`  auth       none — loopback only, local development\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void (async () => {
      console.log("\nshutting down");
      await api.close();
      await close();
      process.exit(0);
    })();
  });
}
