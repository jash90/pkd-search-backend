import dotenv from "dotenv";

dotenv.config();

// Environment configuration
export const env = {
  qdrant: {
    url: process.env.QDRANT_URL || "",
    apiKey: process.env.QDRANT_API_KEY || "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  server: {
    port: process.env.PORT || 3000,
  },
  database: {
    url: process.env.DATABASE_URL || "",
  },
};

// Validate required configuration
export function validateEnv(): void {
  if (!env.qdrant.url || !env.qdrant.apiKey || !env.openai.apiKey) {
    console.error("Missing required environment variables: QDRANT_URL, QDRANT_API_KEY, or OPENAI_API_KEY");
    process.exit(1);
  }

  if (!env.database.url) {
    console.error("Missing required environment variable: DATABASE_URL for PostgreSQL");
    process.exit(1);
  }
} 