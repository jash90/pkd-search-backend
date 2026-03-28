import { QdrantClient } from "@qdrant/js-client-rest";
import { LRUCache } from "lru-cache";
import { env } from "../config/env";
import { pool } from "../db/database";
import { dedup } from "../utils/dedup";

// Initialize Qdrant client
// QdrantClient defaults to port 6333; for HTTPS public URLs we must use port 443
const qdrantUrl = new URL(env.qdrant.url);
export const qdrantClient = new QdrantClient({
  url: env.qdrant.url,
  port: qdrantUrl.protocol === "https:" ? 443 : 6333,
  apiKey: env.qdrant.apiKey,
});

const qdrantLru = new LRUCache<string, any[]>({ max: 100, ttl: 1000 * 60 * 60 });

/**
 * Fetch Qdrant data from the 'cache' table, otherwise query Qdrant
 * and store the results in Postgres.
 */
export async function getCachedQdrantData(serviceDescription: string, embedding: number[]): Promise<any[]> {
  return dedup(`qdrant:${serviceDescription}`, async () => {
    try {
      const lruHit = qdrantLru.get(serviceDescription);
      if (lruHit) return lruHit;

      const selectResult = await pool.query(
        "SELECT pkdCodeData FROM cache WHERE serviceDescription = $1",
        [serviceDescription]
      );

      // If data found in cache, parse and return it
      if (selectResult?.rowCount && selectResult.rowCount > 0) {
        const row = selectResult.rows[0];
        const parsed = JSON.parse(row.pkdcodedata);
        qdrantLru.set(serviceDescription, parsed);
        return parsed;
      }

      // Otherwise, go fetch new data
      const result = await qdrantClient.query("pkdCode", {
        query: embedding,
        limit: 5,
        with_payload: true,
      });
      const pkdCodeData = result.points;

      const pkdCodeDataJson = JSON.stringify(pkdCodeData);

      // Insert or update the result in 'cache' table
      await pool.query(
        `INSERT INTO cache (serviceDescription, pkdCodeData)
       VALUES ($1, $2)
       ON CONFLICT (serviceDescription)
       DO UPDATE SET pkdCodeData = EXCLUDED.pkdCodeData`,
        [serviceDescription, pkdCodeDataJson]
      );

      qdrantLru.set(serviceDescription, pkdCodeData);
      return pkdCodeData;
    } catch (error) {
      console.error("Error in getCachedQdrantData:", error);
      throw error;
    }
  });
}

/**
 * Get sample elements from Qdrant database using scroll (no vector needed)
 */
export async function getSampleQdrantData(limit: number = 10): Promise<any[]> {
  try {
    const result = await qdrantClient.scroll("pkdCode", {
      limit,
      with_payload: true,
      with_vector: false,
    });
    return result.points;
  } catch (error) {
    console.error("Error getting sample data from Qdrant:", error);
    throw error;
  }
}
