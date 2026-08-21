import { createServer } from "node:http";

import { app } from "./app.js";
import { initializeAdvisorWebSocketServer } from "./websocket/advisor-websocket-server.js";

const port = Number(process.env.PORT) || 3000;
const server = createServer(app);

initializeAdvisorWebSocketServer(server);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Advisor websocket available at ws://localhost:${port}/ws/advisor`);
});
