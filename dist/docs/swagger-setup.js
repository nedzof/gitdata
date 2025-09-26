"use strict";
/**
 * D20 Phase 1: Swagger UI Setup for BSV Overlay Network API
 * Provides interactive API documentation and testing interface
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwaggerUI = setupSwaggerUI;
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const openapi_config_1 = require("./openapi-config");
const packageJson = require('../../package.json');
function setupSwaggerUI(app) {
    // Serve OpenAPI JSON spec
    app.get('/docs/openapi.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(openapi_config_1.swaggerSpec);
    });
    // Custom Swagger UI options
    const swaggerUiOptions = {
        customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1976d2; font-size: 36px; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; }
      .swagger-ui .info .description p { font-size: 14px; line-height: 1.6; }
      .swagger-ui .info .description h1 { color: #1976d2; margin-top: 30px; }
      .swagger-ui .info .description h2 { color: #424242; margin-top: 20px; }
      .swagger-ui .opblock.opblock-get .opblock-summary { border-left: 4px solid #4caf50; }
      .swagger-ui .opblock.opblock-post .opblock-summary { border-left: 4px solid #2196f3; }
      .swagger-ui .opblock.opblock-put .opblock-summary { border-left: 4px solid #ff9800; }
      .swagger-ui .opblock.opblock-delete .opblock-summary { border-left: 4px solid #f44336; }
    `,
        customSiteTitle: 'BSV Overlay Network API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            urls: [
                {
                    url: '/docs/openapi.json',
                    name: 'BSV Overlay Network API v' + packageJson.version,
                },
            ],
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'none',
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true,
            requestInterceptor: (request) => {
                // Add default headers for all requests
                request.headers['Content-Type'] = 'application/json';
                request.headers['Accept'] = 'application/json';
                return request;
            },
        },
    };
    // Setup Swagger UI middleware
    app.use('/docs', swagger_ui_express_1.default.serve);
    app.get('/docs', swagger_ui_express_1.default.setup(openapi_config_1.swaggerSpec, swaggerUiOptions));
    console.log('📖 Swagger UI documentation available at: http://localhost:8788/docs');
    console.log('📄 OpenAPI JSON specification available at: http://localhost:8788/docs/openapi.json');
}
//# sourceMappingURL=swagger-setup.js.map