import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import routes from "./routes";

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
}));
app.use(express.json());

// Rate limiting: 20 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// Routes
app.use(routes);

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
