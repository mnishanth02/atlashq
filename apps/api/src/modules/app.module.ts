import { Module } from "@nestjs/common";
import { AuthPlaceholderController } from "./auth-placeholder.controller.js";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [AuthPlaceholderController, HealthController],
})
export class AppModule {}
