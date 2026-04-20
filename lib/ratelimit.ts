import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const generationRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "30 m"),
  analytics: true,
  prefix: "logic:generate",
});

export const projectWriteRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(40, "1 h"),
  analytics: true,
  prefix: "logic:project-write",
});

export const feedbackRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(8, "10 m"),
  analytics: true,
  prefix: "logic:feedback",
});

export const apiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "logic:api",
});
