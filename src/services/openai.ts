import OpenAI from "openai";
import { LRUCache } from "lru-cache";
import { env } from "../config/env";
import { pool } from "../db/database";
import { dedup } from "../utils/dedup";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: env.openai.apiKey });

const AI_CACHE_VERSION = "agentic-v2";
const aiCacheKey = (serviceDescription: string) => `${AI_CACHE_VERSION}:${serviceDescription}`;

const aiLru = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 60 });
const planLru = new LRUCache<string, string[]>({ max: 100, ttl: 1000 * 60 * 60 });

/**
 * Generate embedding for a service description
 */
export async function generateEmbedding(serviceDescription: string): Promise<number[]> {
  return dedup(`emb:${serviceDescription}`, async () => {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: serviceDescription,
    });
    return response.data[0].embedding;
  });
}

function safeJsonObject(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Agentic RAG planner: expands the user's plain-language business description
 * into a few retrieval intents. This is the cheap "planning agent" from the
 * diagram; no hidden reasoning is returned or stored.
 */
export async function planRetrievalQueries(serviceDescription: string): Promise<string[]> {
  return dedup(`plan:${serviceDescription}`, async () => {
    const cached = planLru.get(serviceDescription);
    if (cached) return cached;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Jesteś agentem planującym wyszukiwanie PKD 2025. Zwróć wyłącznie JSON: {"queries":[string]}. Podaj 1-3 krótkie polskie zapytania do wyszukiwarki wektorowej. Popraw literówki, brak polskich znaków i odmiany (opis użytkownika -> poprawne hasła branżowe), uwzględnij synonimy, realne czynności i możliwą produkcję/sprzedaż/naprawę, ale nie dopisuj niepowiązanych branż.`,
        },
        { role: "user", content: serviceDescription },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = safeJsonObject(response.choices[0].message.content || "");
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
      : [];
    const unique = Array.from(new Set([serviceDescription, ...queries])).slice(0, 3);
    planLru.set(serviceDescription, unique);
    return unique;
  });
}

/**
 * Check aiCache table only (no embedding/Qdrant needed)
 */
export async function getAiCacheOnly(serviceDescription: string): Promise<any | null> {
  const key = aiCacheKey(serviceDescription);
  const lruHit = aiLru.get(key);
  if (lruHit) return lruHit;

  const result = await pool.query(
    "SELECT aiSuggestion FROM aiCache WHERE serviceDescription = $1",
    [key]
  );
  if (result?.rowCount && result.rowCount > 0) {
    const parsed = JSON.parse(result.rows[0].aisuggestion);
    aiLru.set(key, parsed);
    return parsed;
  }
  return null;
}

/**
 * Fetch AI suggestion from the 'aiCache' table, otherwise generate new suggestion
 * and store it in Postgres.
 */
export async function getCachedAiSuggestion(serviceDescription: string, pkdCodeData: any[]): Promise<string> {
  const key = aiCacheKey(serviceDescription);
  return dedup(`ai:${key}`, async () => {
    try {
      const lruHit = aiLru.get(key);
      if (lruHit) return lruHit;

      const selectResult = await pool.query(
        "SELECT aiSuggestion FROM aiCache WHERE serviceDescription = $1",
        [key]
      );

      // If data found in cache, return it
      if (selectResult?.rowCount && selectResult.rowCount > 0) {
        const row = selectResult.rows[0];
        console.log("cached data", row.aisuggestion);
        const parsed = JSON.parse(row.aisuggestion);
        aiLru.set(key, parsed);
        return parsed;
      }

      // Otherwise, generate a new AI suggestion.
      const pkdCodeString = pkdCodeData.map(item => JSON.stringify(item)).join(", ");
      const prompt = `
Jesteś agentem selekcji w agentic RAG dla kodów PKD 2025.
Kandydaci poniżej pochodzą z kilku zapytań retrieval-agentów. Wybierz WYŁĄCZNIE jeden element z tej listy, najlepiej pasujący do opisu użytkownika. Poprawiaj literówki i brak polskich znaków w intencji użytkownika. Nie wybieraj ogólnych kategorii typu "gdzie indziej niesklasyfikowana", jeśli w kandydatach istnieje konkretny kod nazwowo odpowiadający działalności. Nie twórz nowego kodu i nie dopisuj danych spoza kandydatów.

Kandydaci: ${pkdCodeString}

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

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: serviceDescription },
        ],
        response_format: { type: "json_object" },
      });

      const aiOutput = response.choices[0].message.content || "";

      // Insert or update the result in 'aiCache' table
      await pool.query(
        `INSERT INTO aiCache (serviceDescription, aiSuggestion)
       VALUES ($1, $2)
       ON CONFLICT (serviceDescription)
       DO UPDATE SET aiSuggestion = EXCLUDED.aiSuggestion`,
        [key, aiOutput]
      );

      const parsed = JSON.parse(aiOutput);
      aiLru.set(key, parsed);
      return parsed;
    } catch (error) {
      console.error("Error in getCachedAiSuggestion:", error);
      throw error;
    }
  });
}
