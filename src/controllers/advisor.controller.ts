import type { Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { getAdvisorService } from "../advisor/service/advisor-service-instance.js";
import type { AdvisorRequestContext } from "../advisor/types.js";
import { sendResponse } from "../utils/api-response.js";

const readSingleRouteParam = (value: string | string[] | undefined, label: string) => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new HttpError(400, `${label} is required.`);
};

const getRequestContext = (request: Request): AdvisorRequestContext => {
  const session = request.organizationUser;

  if (!session) {
    throw new HttpError(401, "Organization authentication is required.");
  }

  return {
    tenantId: session.tenantId,
    userId: session.sub,
    lenderId: session.lenderId,
    role: session.role,
  };
};

const createConversation = async (request: Request, response: Response) => {
  const context = getRequestContext(request);
  const advisorService = await getAdvisorService();
  const conversation = await advisorService.createConversation(context);

  return sendResponse(response, {
    statusCode: 201,
    success: true,
    message: "Advisor conversation created",
    data: conversation,
  });
};

const getConversation = async (request: Request, response: Response) => {
  const context = getRequestContext(request);
  const conversationId = readSingleRouteParam(
    request.params.conversationId,
    "Conversation ID",
  );
  const advisorService = await getAdvisorService();
  const conversation = await advisorService.getConversation(conversationId);

  if (conversation.context.tenantId !== context.tenantId) {
    throw new HttpError(403, "You cannot access a conversation from another tenant.");
  }

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Advisor conversation fetched",
    data: conversation,
  });
};

const sendMessage = async (request: Request, response: Response) => {
  const context = getRequestContext(request);
  const { message } = request.body as { message?: string };
  const conversationId = readSingleRouteParam(
    request.params.conversationId,
    "Conversation ID",
  );
  const advisorService = await getAdvisorService();

  if (!message || message.trim().length === 0) {
    throw new HttpError(400, "A non-empty message is required.");
  }

  const conversation = await advisorService.getConversation(conversationId);

  if (conversation.context.tenantId !== context.tenantId) {
    throw new HttpError(403, "You cannot send messages to a conversation from another tenant.");
  }

  const result = await advisorService.handleMessage(conversation.id, message);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Advisor message processed",
    data: result,
  });
};

export { createConversation, getConversation, sendMessage };
