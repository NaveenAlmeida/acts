import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// App totalmente dinâmico (SSR + Server Actions) — sem cache incremental por ora.
export default defineCloudflareConfig();
