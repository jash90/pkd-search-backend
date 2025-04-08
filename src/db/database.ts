import { Pool } from "pg";
import { env } from "../config/env";

// Initialize Postgres pool
export const pool = new Pool({
  connectionString: env.database.url,
});

// Create tables if they don't exist
export async function initializeDatabase(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cache (
        serviceDescription TEXT PRIMARY KEY,
        pkdCodeData TEXT
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aiCache (
        serviceDescription TEXT PRIMARY KEY,
        aiSuggestion TEXT
      )
    `);
    
    console.log("Database tables initialized successfully");
  } catch (err) {
    console.error("Error initializing database tables:", err);
    throw err;
  }
} 