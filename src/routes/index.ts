import express from "express";
import processRoutes from "./process";

const router = express.Router();

router.use('/process', processRoutes);

export default router; 