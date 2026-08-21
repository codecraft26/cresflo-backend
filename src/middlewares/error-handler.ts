import type { NextFunction, Request, Response } from "express";

import { sendResponse } from "../utils/api-response.js";

const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  return sendResponse(response, {
    statusCode: 500,
    success: false,
    message: error.message || "Internal server error",
  });
};

export { errorHandler };
