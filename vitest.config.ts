import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // os testes compartilham o mesmo Supabase local — rodar em série evita flakes
    fileParallelism: false,
  },
});
