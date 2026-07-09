import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"] })
  status: "ok" = "ok";

  @ApiProperty({ enum: ["api"] })
  service: "api" = "api";

  @ApiProperty({ type: String, example: "0.0.0" })
  version = "0.0.0";
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({
    operationId: "HealthController_getHealth",
    summary: "Report API process health",
  })
  @ApiOkResponse({ description: "API placeholder is healthy.", type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return new HealthResponseDto();
  }
}
