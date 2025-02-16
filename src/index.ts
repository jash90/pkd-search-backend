import express from "express";
import { QdrantInstance, OpenAiInstance } from "ai-service-hub";
import dotenv from "dotenv";

dotenv.config();

// Load and validate environment configuration
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const port = process.env.PORT || 3000;

if (!qdrantUrl || !qdrantApiKey || !openaiApiKey) {
    console.error("Missing required environment variables: QDRANT_URL, QDRANT_API_KEY, or OPENAI_API_KEY");
    process.exit(1);
}

// Initialize service instances for backend operations
const qdrant = new QdrantInstance({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
});
const openai = new OpenAiInstance(openaiApiKey);

/**
 * Processes the backend task by embedding a service description,
 * querying for pkdCodes and generating a prompt for a chat response.
 */
async function processServiceData(serviceDescription: string): Promise<string> {
    try {
        const embedding = await openai.embedding(serviceDescription);
        const pkdCodeData = await qdrant.queryQdrant(embedding, "pkdCode", 5);
        const pkdCodeString = pkdCodeData.map(item => JSON.stringify(item)).join(", ");
        const prompt = `Wybierz z listy najbardziej pasujący do danych podanych przez użytkownika item ${pkdCodeString} a resztę zwróc jako json`;

        const response = await openai.chat(serviceDescription, prompt, "gpt-4o");
        return response || "No response from OpenAI";
    } catch (error) {
        console.error("Error during backend processing:", error);
        throw new Error("Backend processing error");
    }
}

const app = express();
app.use(express.json());

// Endpoint to process the backend task
app.get("/process/:serviceDescription", async (req, res) => {
    try {
        const { serviceDescription } = req.params;
        const response = await processServiceData(serviceDescription);
        res.status(200).json({ message: "Backend service response", data: response });
    } catch (error) {
        res.status(500).json({ error: "An error occurred during backend processing" });
    }
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
