import { OpenAiInstance } from "ai-service-hub";
import { env } from "../config/env";
import { pool } from "../db/database";

// Initialize OpenAI instance
export const openaiClient = new OpenAiInstance(env.openai.apiKey);

/**
 * Generate embedding for a service description
 */
export async function generateEmbedding(serviceDescription: string): Promise<number[]> {
  return await openaiClient.embedding(serviceDescription);
}

/**
 * Fetch AI suggestion from the 'aiCache' table, otherwise generate new suggestion
 * and store it in Postgres.
 */
export async function getCachedAiSuggestion(serviceDescription: string, pkdCodeData: any[]): Promise<string> {
  try {
    const selectResult = await pool.query(
      "SELECT aiSuggestion FROM aiCache WHERE serviceDescription = $1",
      [serviceDescription]
    );

    // If data found in cache, return it
    if (selectResult?.rowCount && selectResult.rowCount > 0) {
      const row = selectResult.rows[0];
      console.log("cached data", row.aisuggestion);
      return JSON.parse(row.aisuggestion);
    }

    // Otherwise, generate a new AI suggestion
    const pkdCodeString = pkdCodeData.map(item => JSON.stringify(item)).join(", ");
    const prompt = `
    Na podstawie danych podanych przez użytkownika wybierz z listy najbardziej pasujący element ${pkdCodeString}.  
Wynik zwróć wyłącznie w formacie JSON zgodnym ze schematem:  
{
  "id": string,            // identyfikator elementu z listy
  "version": number,       // wersja rekordu
  "score": number,         // stopień dopasowania (0–1)
  "payload": {
    "grupaKlasaPodklasa": string,   // kod PKD
    "nazwaGrupowania": string,      // nazwa grupowania
    "opisDodatkowy": string         // szczegółowy opis
  }
}  

Przykładowa odpowiedź:  
{
  "id": "5f5d9030-ff0a-4a2c-b2e9-e31ef5e1abed",
  "version": 739,
  "score": 0.5785652,
  "payload": {
    "grupaKlasaPodklasa": "43.91.Z",
    "nazwaGrupowania": "Roboty murarskie",
    "opisDodatkowy": "Podklasa ta obejmuje: murowanie, układanie kostki, osadzanie kamienia i inne roboty murarskie."
  }
}
`;

    const response = await openaiClient.chat(serviceDescription, prompt, "gpt-4o", {
      type: "json_object",
    });

    const aiOutput = response || "";

    // Insert or update the result in 'aiCache' table
    await pool.query(
      `INSERT INTO aiCache (serviceDescription, aiSuggestion)
       VALUES ($1, $2)
       ON CONFLICT (serviceDescription)
       DO UPDATE SET aiSuggestion = EXCLUDED.aiSuggestion`,
      [serviceDescription, aiOutput]
    );

    return JSON.parse(aiOutput);
  } catch (error) {
    console.error("Error in getCachedAiSuggestion:", error);
    throw error;
  }
} 