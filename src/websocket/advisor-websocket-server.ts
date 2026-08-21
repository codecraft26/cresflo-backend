import { URL } from "node:url";

import type { Server as HttpServer, IncomingMessage } from "node:http";

import { WebSocketServer, type WebSocket } from "ws";

import { HttpError } from "../advisor/errors.js";
import { getAdvisorService } from "../advisor/service/advisor-service-instance.js";
import type { AdvisorRequestContext } from "../advisor/types.js";
import { organizationAuthService } from "../organization/auth/organization-auth-service.js";

type ClientMessage =
  | {
      type: "create_conversation";
    }
  | {
      type: "get_conversation";
      conversationId: string;
    }
  | {
      type: "send_message";
      conversationId: string;
      message: string;
    };

type ServerEvent =
  | {
      type: "connected";
      user: {
        userId: string;
        tenantId: string;
        lenderId: string;
        email: string;
        role: string;
      };
    }
  | {
      type: "conversation_created";
      conversation: unknown;
    }
  | {
      type: "conversation_loaded";
      conversation: unknown;
    }
  | {
      type: "planning_started";
      conversationId: string;
    }
  | {
      type: "plan_ready";
      conversationId: string;
      planKind: string;
    }
  | {
      type: "message_chunk";
      conversationId: string;
      chunk: string;
    }
  | {
      type: "message_complete";
      conversationId: string;
      answer: unknown;
      conversation: unknown;
      provider: string;
    }
  | {
      type: "error";
      message: string;
    };

const readTokenFromRequest = (request: IncomingMessage) => {
  const requestUrl = request.url ?? "/";
  const url = new URL(requestUrl, "http://localhost");
  const token = url.searchParams.get("token");

  if (!token) {
    throw new HttpError(401, "Missing organization token in websocket query.");
  }

  return token;
};

const buildContextFromToken = (token: string): AdvisorRequestContext & { email: string } => {
  const session = organizationAuthService.verifyToken(token);

  return {
    tenantId: session.tenantId,
    userId: session.sub,
    lenderId: session.lenderId,
    role: session.role,
    email: session.email,
  };
};

const send = (socket: WebSocket, event: ServerEvent) => {
  socket.send(JSON.stringify(event));
};

const chunkText = (value: string, chunkSize = 24) => {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks;
};

const sleep = (durationMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const parseMessage = (raw: string): ClientMessage => {
  const parsed = JSON.parse(raw) as ClientMessage;

  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new HttpError(400, "Invalid websocket payload.");
  }

  return parsed;
};

const initializeAdvisorWebSocketServer = (server: HttpServer) => {
  const wss = new WebSocketServer({
    noServer: true,
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      const requestUrl = request.url ?? "/";
      const url = new URL(requestUrl, "http://localhost");

      if (url.pathname !== "/ws/advisor") {
        socket.destroy();
        return;
      }

      readTokenFromRequest(request);

      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit("connection", websocket, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", async (socket, request) => {
    try {
      const token = readTokenFromRequest(request);
      const context = buildContextFromToken(token);

      send(socket, {
        type: "connected",
        user: {
          userId: context.userId,
          tenantId: context.tenantId,
          lenderId: context.lenderId,
          email: context.email,
          role: context.role,
        },
      });

      socket.on("message", async (rawMessage) => {
        try {
          const payload = parseMessage(rawMessage.toString());
          const advisorService = await getAdvisorService();

          if (payload.type === "create_conversation") {
            const conversation = await advisorService.createConversation(context);

            send(socket, {
              type: "conversation_created",
              conversation,
            });

            return;
          }

          if (payload.type === "get_conversation") {
            const conversation = await advisorService.getConversation(payload.conversationId);

            if (conversation.context.tenantId !== context.tenantId) {
              throw new HttpError(403, "You cannot access another organization's conversation.");
            }

            send(socket, {
              type: "conversation_loaded",
              conversation,
            });

            return;
          }

          if (payload.type === "send_message") {
            const conversation = await advisorService.getConversation(payload.conversationId);

            if (conversation.context.tenantId !== context.tenantId) {
              throw new HttpError(403, "You cannot message another organization's conversation.");
            }

            const result = await advisorService.handleMessageWithHooks(
              payload.conversationId,
              payload.message,
              {
                onPlanningStarted: async () => {
                  send(socket, {
                    type: "planning_started",
                    conversationId: payload.conversationId,
                  });
                },
                onPlanReady: async (plan) => {
                  send(socket, {
                    type: "plan_ready",
                    conversationId: payload.conversationId,
                    planKind: plan.kind,
                  });
                },
                onAnswerReady: async (answer) => {
                  for (const chunk of chunkText(answer.summary)) {
                    send(socket, {
                      type: "message_chunk",
                      conversationId: payload.conversationId,
                      chunk,
                    });
                    await sleep(35);
                  }
                },
              },
            );

            send(socket, {
              type: "message_complete",
              conversationId: payload.conversationId,
              answer: result.answer,
              conversation: result.conversation,
              provider: result.provider,
            });
          }
        } catch (error) {
          send(socket, {
            type: "error",
            message: error instanceof Error ? error.message : "Unexpected websocket error.",
          });
        }
      });
    } catch (error) {
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Websocket initialization failed.",
      });
      socket.close();
    }
  });

  return wss;
};

export { initializeAdvisorWebSocketServer };
