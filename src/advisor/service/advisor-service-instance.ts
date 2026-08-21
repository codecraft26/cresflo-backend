import { createAdvisorService } from "../bootstrap.js";

let advisorServicePromise: ReturnType<typeof createAdvisorService> | null = null;

const getAdvisorService = () => {
  if (!advisorServicePromise) {
    advisorServicePromise = createAdvisorService();
  }

  return advisorServicePromise;
};

export { getAdvisorService };
