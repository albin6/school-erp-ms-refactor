import redisClient from "../../../infrastructure/redis/redis.client";
const BLACKLIST_PREFIX = "auth:blacklist:";
export const AuthCacheService = {
    blacklistToken: async (token: string, expiresSeconds: number) => {
        await redisClient.set(`${BLACKLIST_PREFIX}${token}`, "revoked", { EX: expiresSeconds });
    },
    isTokenBlacklisted: async (token: string): Promise<boolean> => {
        const result = await redisClient.get(`${BLACKLIST_PREFIX}${token}`);
        return result === "revoked";
    }
};
