import { Router } from "express";

import {
  createConversation,
  getConversation,
  sendMessage,
} from "../controllers/advisor.controller.js";
import { requireOrganizationAuth } from "../middlewares/organization-auth.js";

const advisorRouter = Router();

advisorRouter.use(requireOrganizationAuth);
advisorRouter.post("/conversations", createConversation);
advisorRouter.get("/conversations/:conversationId", getConversation);
advisorRouter.post("/conversations/:conversationId/messages", sendMessage);

export { advisorRouter };
