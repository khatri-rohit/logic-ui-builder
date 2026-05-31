import { NextResponse } from "next/server";

export interface ApiErrorResponse {
  error: true;
  code?: string;
  message: string;
  data?: Record<string, unknown>;
}

export function errorResponse(
  message: string,
  status: number,
  options?: {
    code?: string;
    data?: Record<string, unknown>;
    retryAfter?: number;
  },
): NextResponse {
  const body: ApiErrorResponse = { error: true, message };
  if (options?.code) body.code = options.code;
  if (options?.data) body.data = options.data;

  const headers: Record<string, string> = {};
  if (options?.retryAfter) {
    headers["Retry-After"] = String(options.retryAfter);
  }

  return NextResponse.json(body, { status, headers });
}

export function tooManyRequestsResponse(resetTimestamp?: number): NextResponse {
  const retryAfter = resetTimestamp
    ? Math.ceil((resetTimestamp - Date.now()) / 1000)
    : 60;
  return errorResponse("Too many requests.", 429, { retryAfter });
}
