import { getCachedQdrantData } from "./qdrant";
import { generateEmbedding, getCachedAiSuggestion } from "./openai";

/**
 * Processes the backend task by embedding a service description,
 * querying for pkdCodes and generating a prompt for a chat response.
 */
export async function processServiceData(serviceDescription: string): Promise<{ pkdCodeData: any[]; aiSuggestion: string }> {
  try {
    const embedding = await generateEmbedding(serviceDescription);
    const pkdCodeData = await getCachedQdrantData(serviceDescription, embedding);
    const aiSuggestion = await getCachedAiSuggestion(serviceDescription, pkdCodeData);
    
    return {
      pkdCodeData,
      aiSuggestion,
    };
  } catch (error) {
    console.error("Error during backend processing:", error);
    throw new Error("Backend processing error");
  }
}

/**
 * Process only database data
 */
export async function processServiceDataOnlyDatabase(serviceDescription: string): Promise<{ pkdCodeData: any[] }> {
  try {
    const embedding = await generateEmbedding(serviceDescription);
    const pkdCodeData = await getCachedQdrantData(serviceDescription, embedding);
    
    return { pkdCodeData };
  } catch (error) {
    console.error("Error during backend processing:", error);
    throw new Error("Backend processing error");
  }
}

/**
 * Process only AI suggestion data
 */
export async function processServiceDataOnlyAi(serviceDescription: string): Promise<{ aiSuggestion: string }> {
  try {
    const embedding = await generateEmbedding(serviceDescription);
    const pkdCodeData = await getCachedQdrantData(serviceDescription, embedding);
    const aiSuggestion = await getCachedAiSuggestion(serviceDescription, pkdCodeData);
    
    return { aiSuggestion };
  } catch (error) {
    console.error("Error during backend processing:", error);
    throw new Error("Backend processing error");
  }
} 