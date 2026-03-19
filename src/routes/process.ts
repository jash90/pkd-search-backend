import express, { Request, Response, NextFunction } from "express";
import {
  processServiceData,
  processServiceDataOnlyDatabase,
  processServiceDataOnlyAi
} from "../services/processor";

const router = express.Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceDescription, onlyDatabase, onlyAi } = req.query;

    if (!serviceDescription || typeof serviceDescription !== 'string') {
      res.status(400).json({ error: "Service description is required" });
      return;
    }

    if (onlyDatabase) {
      const { pkdCodeData } = await processServiceDataOnlyDatabase(serviceDescription);
      res.status(200).json({ data: { pkdCodeData } });
    } else if (onlyAi) {
      const { aiSuggestion } = await processServiceDataOnlyAi(serviceDescription);
      res.status(200).json({ data: { aiSuggestion } });
    } else {
      const { aiSuggestion, pkdCodeData } = await processServiceData(serviceDescription);
      res.status(200).json({ data: { aiSuggestion, pkdCodeData } });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
