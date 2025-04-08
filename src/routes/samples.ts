import express from "express";
import { getSampleQdrantData } from "../services/qdrant";

const router = express.Router();

// @ts-ignore - Bypassing TypeScript error for Express router handler types
router.get("/", (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Validate limit parameter
    const validLimit = Math.min(Math.max(1, limit), 50); // Limit between 1 and 50
    
    // Get sample data from Qdrant
    getSampleQdrantData(validLimit)
      .then((sampleData) => {
        res.status(200).json({ 
          data: sampleData,
          count: sampleData.length
        });
      })
      .catch(next);
  } catch (error) {
    console.error("Error processing sample request:", error);
    next(error);
  }
});

export default router; 