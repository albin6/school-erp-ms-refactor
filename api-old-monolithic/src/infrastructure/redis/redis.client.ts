import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();
const redisClient = createClient({
    url: process.env.REDIS_URL || "redis:
});
redisClient.on("error", (err) => console.error(" Redis Client Error", err));
redisClient.on("connect", () => console.log(" Redis Client Connected"));
export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};
export default redisClient;
