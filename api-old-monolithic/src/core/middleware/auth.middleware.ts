import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import * as TokenService from "../security/token.service";
import { AuthCacheService } from "../../modules/auth/services/auth.cache.service";
export interface AuthRequest extends Request {
    user?: any;
}
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError("No token provided", 401);
        }
        const token = authHeader.split(" ")[1];
        const isBlacklisted = await AuthCacheService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            throw new AppError("Token revoked", 401);
        }
        const payload = TokenService.verifyAccessToken(token);
        (req as AuthRequest).user = payload;
        next();
    } catch (error) {
        console.error("Authentication Error Details:", error);
        next(new AppError("Invalid or Expired Token", 401));
    }
};
