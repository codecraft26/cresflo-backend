import OpenAI from "openai";

import { env } from "../../config/env.js";

const createOpenAiClient = () =>
  new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

export { createOpenAiClient };
