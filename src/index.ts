import app from "./app";
import { env, validateEnv } from "./config/env";
import { initializeDatabase } from "./db/database";

// Validate environment configuration
validateEnv();

// Initialize database and start server
initializeDatabase()
  .then(() => {
    // Start the Express server
    app.listen(env.server.port, () => {
      console.log(`Server is running on port ${env.server.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }); 