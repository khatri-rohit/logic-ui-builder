import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const generationRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  analytics: true,
  prefix: "logic:generate",
});

export const apiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "logic:api",
});
