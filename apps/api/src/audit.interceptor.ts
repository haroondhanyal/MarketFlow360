import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { SignedRequest } from "./auth";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private db: PrismaService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<SignedRequest>();
    if (!req.workspaceId || !req.authUser || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next.handle();
    const entity = (req.baseUrl.split("/").filter(Boolean).at(-1) ?? "workspace").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
    const route = `${req.method} ${req.route?.path ?? req.path}`.slice(0, 180);
    const rawEntityId = req.params?.id;
    const entityId = typeof rawEntityId === "string" ? rawEntityId : undefined;
    return next.handle().pipe(tap(() => {
      void this.db.auditEvent.create({ data: { workspaceId: req.workspaceId!, actorId: req.authUser!.id, action: `api.${req.method.toLowerCase()}`, entity, entityId, details: { route } } }).catch(() => undefined);
    }));
  }
}
