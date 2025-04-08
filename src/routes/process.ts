import express from "express";
import { 
  processServiceData, 
  processServiceDataOnlyDatabase, 
  processServiceDataOnlyAi 
} from "../services/processor";

const router = express.Router();

// @ts-ignore - Bypassing TypeScript error for Express router handler types
router.get("/", (req, res, next) => {
  try {
    const { serviceDescription, onlyDatabase, onlyAi } = req.query;
    
    if (!serviceDescription || typeof serviceDescription !== 'string') {
      return res.status(400).json({ error: "Service description is required" });
    }

    if (onlyDatabase) {
      processServiceDataOnlyDatabase(serviceDescription)
        .then(({ pkdCodeData }) => {
          res.status(200).json({ data: { pkdCodeData } });
        })
        .catch(next);
    } else if (onlyAi) {
      processServiceDataOnlyAi(serviceDescription)
        .then(({ aiSuggestion }) => {
          res.status(200).json({ data: { aiSuggestion } });
        })
        .catch(next);
    } else {
      processServiceData(serviceDescription)
        .then(({ aiSuggestion, pkdCodeData }) => {
          res.status(200).json({ data: { aiSuggestion, pkdCodeData } });
        })
        .catch(next);
    }
  } catch (error) {
    console.error("Error processing request:", error);
    next(error);
  }
});

export default router; 