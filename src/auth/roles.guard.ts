import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get the required roles for this specific route from metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. If no roles are defined, the route is public (or just requires JWT)
    if (!requiredRoles) {
      return true;
    }

    // 3. Get the user from the request (populated by JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) return false;

    // 4. Check if the user's role matches one of the required roles
    return requiredRoles.some((role) => user.role === role);
  }
}
