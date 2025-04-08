import express from "express";
import processRoutes from "./process";
import samplesRoutes from "./samples";

const router = express.Router();

router.use('/process', processRoutes);
router.use('/samples', samplesRoutes);

export default router; 