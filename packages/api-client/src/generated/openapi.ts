/* Generated from apps/api/openapi/openapi.json. Do not edit by hand. */

export type paths = {
  "/api/v1/health": {
    get: {
      responses: {
        "200": {
          content: {
            "application/json": components["schemas"]["HealthResponseDto"];
          };
        };
      };
    };
  };
};

export type components = {
  schemas: {
    HealthResponseDto: {
      status: "ok";
      service: "api";
      version: string;
    };
  };
};
