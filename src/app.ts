import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(routes);

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app; 