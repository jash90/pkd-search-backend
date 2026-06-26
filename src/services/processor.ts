import { getCachedQdrantData } from "./qdrant";
import {
  generateEmbedding,
  getCachedAiSuggestion,
  getAiCacheOnly,
  planRetrievalQueries,
} from "./openai";

type PkdPoint = {
  id?: string | number;
  score?: number;
  payload?: { grupaKlasaPodklasa?: string };
  [key: string]: any;
};

function mergeCandidates(groups: PkdPoint[][]): PkdPoint[] {
  const byKey = new Map<string, PkdPoint>();

  for (const item of groups.flat()) {
    const key = String(item.payload?.grupaKlasaPodklasa ?? item.id ?? JSON.stringify(item.payload));
    const previous = byKey.get(key);
    if (!previous || (item.score ?? 0) > (previous.score ?? 0)) byKey.set(key, item);
  }

  return [...byKey.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
}

async function retrieveAgenticCandidates(serviceDescription: string): Promise<PkdPoint[]> {
  const queries = await planRetrievalQueries(serviceDescription);
  const groups = await Promise.all(
    queries.map(async (query) => {
      const embedding = await generateEmbedding(query);
      return getCachedQdrantData(query, embedding, 5);
    }),
  );

  return mergeCandidates(groups);
}

/**
 * Agentic RAG pipeline:
 * 1. planning agent expands the business description into retrieval intents,
 * 2. retrieval agents query Qdrant for each intent,
 * 3. selection agent picks one grounded PKD code from the merged candidates.
 */
export async function processServiceData(serviceDescription: string): Promise<{ pkdCodeData: PkdPoint[]; aiSuggestion: any }> {
  try {
    const pkdCodeData = await retrieveAgenticCandidates(serviceDescription);
    const aiSuggestion = await getCachedAiSuggestion(serviceDescription, pkdCodeData);

    return {
      pkdCodeData,
      aiSuggestion,
    };
  } catch (error) {
    console.error("Error during agentic RAG processing:", error);
    throw new Error("Backend processing error");
  }
}

/**
 * Process only retrieval-agent data.
 */
export async function processServiceDataOnlyDatabase(serviceDescription: string): Promise<{ pkdCodeData: PkdPoint[] }> {
  try {
    const pkdCodeData = await retrieveAgenticCandidates(serviceDescription);
    return { pkdCodeData };
  } catch (error) {
    console.error("Error during agentic retrieval processing:", error);
    throw new Error("Backend processing error");
  }
}

/**
 * Process only AI suggestion data — check final memory first, skip retrieval if hit.
 */
export async function processServiceDataOnlyAi(serviceDescription: string): Promise<{ aiSuggestion: any }> {
  try {
    const cached = await getAiCacheOnly(serviceDescription);
    if (cached) return { aiSuggestion: cached };

    const { aiSuggestion } = await processServiceData(serviceDescription);
    return { aiSuggestion };
  } catch (error) {
    console.error("Error during agentic selection processing:", error);
    throw new Error("Backend processing error");
  }
}
