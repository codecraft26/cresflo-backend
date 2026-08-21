import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { sendResponse } from "../utils/api-response.js";

const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  return sendResponse(response, {
    statusCode: error instanceof HttpError ? error.statusCode : 500,
    success: false,
    message: error.message || "Internal server error",
  });
};

export { errorHandler };
