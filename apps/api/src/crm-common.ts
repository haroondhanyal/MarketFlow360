import { SignedRequest } from "./auth";

export const scoped = (req: SignedRequest) => ({ workspaceId: req.workspaceId! });
