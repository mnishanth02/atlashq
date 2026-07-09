import { betterAuthRouteMountPath } from "@atlashq/auth";
import { All, Controller, HttpCode } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

@ApiExcludeController()
@Controller("api/auth")
export class AuthPlaceholderController {
  @All("*path")
  @HttpCode(501)
  handleBetterAuth() {
    return {
      status: "not_implemented",
      provider: "better-auth",
      routeMountPath: betterAuthRouteMountPath,
      TODO: "Mount the Better Auth handler with database-backed configuration in the auth package.",
    };
  }
}
