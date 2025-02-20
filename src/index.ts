import express from "express";
import cors from "cors";
import { QdrantInstance, OpenAiInstance } from "ai-service-hub";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// Load and validate environment configuration
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

if (!qdrantUrl || !qdrantApiKey || !openaiApiKey) {
    console.error("Missing required environment variables: QDRANT_URL, QDRANT_API_KEY, or OPENAI_API_KEY");
    process.exit(1);
}

if (!databaseUrl) {
    console.error("Missing required environment variable: DATABASE_URL for PostgreSQL");
    process.exit(1);
}

// Initialize service instances for backend operations
const qdrant = new QdrantInstance({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
});
const openai = new OpenAiInstance(openaiApiKey);

// Initialize Postgres pool
const pool = new Pool({
    connectionString: databaseUrl,
});

// Create tables if they don't exist
pool.query(`
    CREATE TABLE IF NOT EXISTS cache (
        serviceDescription TEXT PRIMARY KEY,
        pkdCodeData TEXT
    )
`).catch((err) => console.error("Error creating 'cache' table:", err));

pool.query(`
    CREATE TABLE IF NOT EXISTS aiCache (
        serviceDescription TEXT PRIMARY KEY,
        aiSuggestion TEXT
    )
`).catch((err) => console.error("Error creating 'aiCache' table:", err));

/**
 * Fetch Qdrant data from the 'cache' table, otherwise query OpenAI + Qdrant
 * and store the results in Postgres.
 */
async function getCachedQdrantData(serviceDescription: string): Promise<any[]> {
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
        const embedding = await openai.embedding(serviceDescription);
        const pkdCodeData = await qdrant.queryQdrant(embedding, "pkdCode", 5);
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

/**
 * Fetch AI suggestion from the 'aiCache' table, otherwise generate new suggestion
 * and store it in Postgres.
 */
async function getCachedAiSuggestion(serviceDescription: string, pkdCodeData: any[]): Promise<string> {
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
        const prompt = `Wybierz z listy najbardziej pasujący do danych podanych przez użytkownika item ${pkdCodeString} a resztę zwróc jako json`;

        const response = await openai.chat(serviceDescription, prompt, "gpt-4o", {
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

        return aiOutput;
    } catch (error) {
        console.error("Error in getCachedAiSuggestion:", error);
        throw error;
    }
}

/**
 * Processes the backend task by embedding a service description,
 * querying for pkdCodes and generating a prompt for a chat response.
 */
async function processServiceData(serviceDescription: string): Promise<{ pkdCodeData: any[]; aiSuggestion: string }> {
    try {
        // Use cached Qdrant query data (cached in database)
        const pkdCodeData = await getCachedQdrantData(serviceDescription);
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

async function processServiceDataOnlyDatabase(serviceDescription: string): Promise<{ pkdCodeData: any[] }> {
    try {
        // Use cached query data (cached in database)
        const pkdCodeData = await getCachedQdrantData(serviceDescription);
        return { pkdCodeData };
    } catch (error) {
        console.error("Error during backend processing:", error);
        throw new Error("Backend processing error");
    }
}

async function processServiceDataOnlyAi(serviceDescription: string): Promise<{ aiSuggestion: string }> {
    try {
        // Use cached query data (cached in database)
        const pkdCodeData = await getCachedQdrantData(serviceDescription);
        const aiSuggestion = await getCachedAiSuggestion(serviceDescription, pkdCodeData);
        return { aiSuggestion };
    } catch (error) {
        console.error("Error during backend processing:", error);
        throw new Error("Backend processing error");
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to process the backend task
app.get("/process/", async (req, res) => {
    try {
        const { serviceDescription, onlyDatabase, onlyAi } = req.query;
        if (onlyDatabase) {
            const { pkdCodeData } = await processServiceDataOnlyDatabase(serviceDescription as string);
            res.status(200).json({ data: { pkdCodeData } });
        } else if (onlyAi) {
            const { aiSuggestion } = await processServiceDataOnlyAi(serviceDescription as string);
            res.status(200).json({ data: { aiSuggestion } });
        } else {
            const { aiSuggestion, pkdCodeData } = await processServiceData(serviceDescription as string);
            res.status(200).json({ data: { aiSuggestion, pkdCodeData } });
        }
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
