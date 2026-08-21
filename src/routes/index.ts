import { Router } from "express";

import { advisorRouter } from "./advisor.routes.js";
import { healthRouter } from "./health.routes.js";
import { organizationAuthRouter } from "./organization-auth.routes.js";
import { organizationDocumentsRouter } from "./organization-documents.routes.js";
import { superadminRouter } from "./superadmin.routes.js";

const apiRouter = Router();

apiRouter.use("/advisor", advisorRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/organization-auth", organizationAuthRouter);
apiRouter.use("/organization", organizationDocumentsRouter);
apiRouter.use("/superadmin", superadminRouter);

export { apiRouter };
