import type { NextFunction, Request, Response } from "express";

import { sendResponse } from "../utils/api-response.js";

const notFoundHandler = (
  request: Request,
  response: Response,
  _next: NextFunction,
) => {
  return sendResponse(response, {
    statusCode: 404,
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
};

export { notFoundHandler };
