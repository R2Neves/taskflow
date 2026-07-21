import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user as {
      email?: string;
      systemRole?: string;
    };
    const bootstrapAdmin = this.config
      .get<string>("ADMIN_EMAIL", "rneves@beautyservices.com.br")
      .toLowerCase();
    const allowed =
      user?.systemRole === "ADMIN" ||
      user?.email?.toLowerCase() === bootstrapAdmin;
    if (!allowed) {
      throw new ForbiddenException("Acesso exclusivo para administradores");
    }
    return true;
  }
}
