import { Request, Response, NextFunction } from "express";
import * as healthService from "../services/health.service";
export const getHealth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const health = await healthService.checkHealth();
        res.status(200).json(health);
    } catch (error) {
        next(error);
    }
};
