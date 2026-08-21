import { Router } from "express";

import {
  createConversation,
  getConversation,
  listConversations,
  sendMessage,
} from "../controllers/advisor.controller.js";
import { requireOrganizationAuth } from "../middlewares/organization-auth.js";

const advisorRouter = Router();

advisorRouter.use(requireOrganizationAuth);
advisorRouter.get("/conversations", listConversations);
advisorRouter.post("/conversations", createConversation);
advisorRouter.get("/conversations/:conversationId", getConversation);
advisorRouter.post("/conversations/:conversationId/messages", sendMessage);

export { advisorRouter };
