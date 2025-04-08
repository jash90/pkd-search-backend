import { QdrantInstance } from "ai-service-hub";
import { env } from "../config/env";
import { pool } from "../db/database";

// Initialize Qdrant instance
export const qdrantClient = new QdrantInstance({
  url: env.qdrant.url,
  apiKey: env.qdrant.apiKey,
});

/**
 * Fetch Qdrant data from the 'cache' table, otherwise query Qdrant
 * and store the results in Postgres.
 */
export async function getCachedQdrantData(serviceDescription: string, embedding: number[]): Promise<any[]> {
  try {
    const selectResult = await pool.query(
      "SELECT pkdCodeData FROM cache WHERE serviceDescription = $1",
      [serviceDescription]
    );

    // If data found in cache, parse and return it
    if (selectResult?.rowCount && selectResult.rowCount > 0) {
      const row = selectResult.rows[0];
      return JSON.parse(row.pkdcodedata);
    }

    // Otherwise, go fetch new data
    const pkdCodeData = await qdrantClient.queryQdrant(embedding, "pkdCode", 5);
    const pkdCodeDataJson = JSON.stringify(pkdCodeData);

    // Insert or update the result in 'cache' table
    await pool.query(
      `INSERT INTO cache (serviceDescription, pkdCodeData)
       VALUES ($1, $2)
       ON CONFLICT (serviceDescription)
       DO UPDATE SET pkdCodeData = EXCLUDED.pkdCodeData`,
      [serviceDescription, pkdCodeDataJson]
    );

    return pkdCodeData;
  } catch (error) {
    console.error("Error in getCachedQdrantData:", error);
    throw error;
  }
} 