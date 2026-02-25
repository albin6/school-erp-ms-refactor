import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { LoginSchema, RefreshTokenSchema } from "../dtos/auth.schema";
import { AppError } from "../../../core/utils/AppError";
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const result = await AuthService.login(email, password, ip as string, userAgent);
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            data: {
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name,
                    is_super_admin: result.user.is_super_admin
                },
                accessToken: result.accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) throw new AppError("RefreshToken required", 400);
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const result = await AuthService.refreshToken(refreshToken, ip as string);
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            accessToken: result.accessToken
        });
    } catch (error) {
        next(error);
    }
};
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        const accessToken = req.headers.authorization?.split(' ')[1];
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        let userId: string | undefined;
        if (accessToken) {
            try {
                const payload = require('../../../core/security/token.service').verifyAccessToken(accessToken);
                userId = payload.userId;
            } catch (err) {
            }
        }
        await AuthService.logout(refreshToken, accessToken || '', userId, ip as string, userAgent);
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({
            status: "success",
            message: "Logged out successfully"
        });
    } catch (error) {
        res.clearCookie('refreshToken');
        next(error);
    }
};
export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1];
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        if (!accessToken) {
            throw new AppError("Authentication required", 401);
        }
        const payload = require('../../../core/security/token.service').verifyAccessToken(accessToken);
        const result = await AuthService.logoutAll(payload.userId, ip as string, userAgent);
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({
            status: "success",
            message: result.message
        });
    } catch (error) {
        res.clearCookie('refreshToken');
        next(error);
    }
};
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);
        if (user.userId === '00000000-0000-0000-0000-000000000001') {
            res.json({
                status: "success",
                data: {
                    user: {
                        id: user.userId,
                        email: user.email,
                        name: 'Super Admin (Dev)',
                        is_super_admin: true
                    }
                }
            });
            return;
        }
        const { User } = require("../../../infrastructure/database/models");
        const freshUser = await User.findByPk(user.userId);
        if (!freshUser) throw new AppError("User not found", 404);
        res.json({
            status: "success",
            data: {
                user: {
                    id: freshUser.id,
                    email: freshUser.email,
                    name: freshUser.name,
                    is_super_admin: freshUser.is_super_admin
                }
            }
        });
    } catch (error) {
        next(error);
    }
};
