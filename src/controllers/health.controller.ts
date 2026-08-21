import type { Request, Response } from "express";

import { sendResponse } from "../utils/api-response.js";

const getHealth = (_request: Request, response: Response) => {
  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Server is healthy",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
};

export { getHealth };
