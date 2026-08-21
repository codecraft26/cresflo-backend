import type { Response } from "express";

type ApiResponseOptions<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

type ApiResponseBody<T> = {
  success: boolean;
  message: string;
  data: T | null;
  meta?: Record<string, unknown>;
};

const sendResponse = <T>(
  response: Response,
  { statusCode, success, message, data, meta }: ApiResponseOptions<T>,
) => {
  const responseBody: ApiResponseBody<T> = {
    success,
    message,
    data: data ?? null,
  };

  if (meta) {
    responseBody.meta = meta;
  }

  return response.status(statusCode).json(responseBody);
};

export { sendResponse };
export type { ApiResponseBody, ApiResponseOptions };
