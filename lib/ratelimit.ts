import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Plan-aware burst shield — prevents rapid concurrent abuse within short windows
export function getGenerationBurstLimit(planId: "FREE" | "STANDARD" | "PRO") {
  const limits = {
    FREE: { requests: 3, window: "10 m" as const },
    STANDARD: { requests: 10, window: "5 m" as const },
    PRO: { requests: 30, window: "5 m" as const },
  };
  const { requests, window: w } = limits[planId];
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, w),
    analytics: true,
    prefix: `logic:burst:gen:${planId.toLowerCase()}`,
  });
}

// Non-generation routes keep their existing flat limiters
export const projectWriteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "1 h"),
  analytics: true,
  prefix: "logic:project-write",
});

export const feedbackRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "10 m"),
  analytics: true,
  prefix: "logic:feedback",
});

export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "logic:api",
});
