import express, { Request, Response, NextFunction } from "express";
import { getSampleQdrantData } from "../services/qdrant";

const router = express.Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const validLimit = Math.min(Math.max(1, limit), 50);

    const sampleData = await getSampleQdrantData(validLimit);
    res.status(200).json({
      data: sampleData,
      count: sampleData.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
