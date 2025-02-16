import express from "express";
import { QdrantInstance, OpenAiInstance } from "ai-service-hub";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";

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

// Initialize SQLite database for caching
const db = new sqlite3.Database("./cache.db", (err) => {
    if (err) {
        console.error("Error opening database: " + err.message);
    } else {
        // Table for Qdrant query cache
        db.run(
            "CREATE TABLE IF NOT EXISTS cache(serviceDescription TEXT PRIMARY KEY, pkdCodeData TEXT)",
            (err) => {
                if (err) console.error("Error creating cache table: " + err.message);
            }
        );
        // Table for AI suggestion cache
        db.run(
            "CREATE TABLE IF NOT EXISTS aiCache(serviceDescription TEXT PRIMARY KEY, aiSuggestion TEXT)",
            (err) => {
                if (err) console.error("Error creating aiCache table: " + err.message);
            }
        );
    }
});

// --------------------
// Save cache in database using SQLite for Qdrant queries
async function getCachedQdrantData(serviceDescription: string): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
        db.get(
            "SELECT pkdCodeData FROM cache WHERE serviceDescription = ?",
            [serviceDescription],
            async (err, row) => {
                if (err) {
                    console.error("Database error:", err);
                    return reject(err);
                }
                if (row) {
                    try {
                        const { pkdCodeData } = row as { pkdCodeData: string };
                        const cachedData = JSON.parse(pkdCodeData);
                        return resolve(cachedData);
                    } catch (parseError) {
                        console.error("Error parsing cache data:", parseError);
                        // Proceed to fetch new data if parsing fails
                    }
                }
                try {
                    const embedding = await openai.embedding(serviceDescription);
                    const pkdCodeData = await qdrant.queryQdrant(embedding, "pkdCode", 5);
                    const pkdCodeDataJson = JSON.stringify(pkdCodeData);
                    db.run(
                        "INSERT OR REPLACE INTO cache (serviceDescription, pkdCodeData) VALUES (?, ?)",
                        [serviceDescription, pkdCodeDataJson],
                        (insertErr) => {
                            if (insertErr) {
                                console.error("Error inserting cache data:", insertErr);
                            }
                            return resolve(pkdCodeData);
                        }
                    );
                } catch (error) {
                    console.error("Error fetching data:", error);
                    return reject(error);
                }
            }
        );
    });
}

// Helper function to get cached AI suggestion
async function getCachedAiSuggestion(serviceDescription: string, pkdCodeData: any[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        db.get(
            "SELECT aiSuggestion FROM aiCache WHERE serviceDescription = ?",
            [serviceDescription],
            async (err, row) => {
                if (err) {
                    console.error("Database error:", err);
                    return reject(err);
                }
                if (row) {
                    try {
                        const { aiSuggestion } = row as { aiSuggestion: string };
                        return resolve(aiSuggestion);
                    } catch (parseError) {
                        console.error("Error parsing AI suggestion cache data:", parseError);
                    }
                }
                try {
                    const pkdCodeString = pkdCodeData.map(item => JSON.stringify(item)).join(", ");
                    const prompt = `Wybierz z listy najbardziej pasujący do danych podanych przez użytkownika item ${pkdCodeString} a resztę zwróc jako json`;
                    const response = await openai.chat(serviceDescription, prompt, "gpt-4o", {
                        type: "json_object",
                    });
                    db.run(
                        "INSERT OR REPLACE INTO aiCache (serviceDescription, aiSuggestion) VALUES (?, ?)",
                        [serviceDescription, response || ""],
                        (insertErr) => {
                            if (insertErr) {
                                console.error("Error inserting AI suggestion cache:", insertErr);
                            }
                            return resolve(response || "");
                        }
                    );
                } catch (error) {
                    console.error("Error fetching AI suggestion:", error);
                    return reject(error);
                }
            }
        );
    });
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
            res.status(200).json({ data: { aiSuggestion: JSON.parse(aiSuggestion) } });
        } else {
            const { aiSuggestion, pkdCodeData } = await processServiceData(serviceDescription as string);
            res.status(200).json({ data: { aiSuggestion: JSON.parse(aiSuggestion), pkdCodeData: pkdCodeData } });
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
