import jwt from "jsonwebtoken";
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error(" JWT Secrets not defined in environment variables!");
}
export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    tenantId?: string;
    subRole?: string;
    exp?: number;
    iat?: number;
}
export const generateTokens = (payload: TokenPayload) => {
    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES as any });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES as any });
    return { accessToken, refreshToken };
};
export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
};
export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
};
