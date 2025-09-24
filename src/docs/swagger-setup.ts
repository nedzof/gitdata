/**
 * D20 Phase 1: Swagger UI Setup for BSV Overlay Network API
 * Provides interactive API documentation and testing interface
 */

import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './openapi-config';

const packageJson = require('../../package.json');

export function setupSwaggerUI(app: Application): void {
  // Serve OpenAPI JSON spec
  app.get('/docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
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
      requestInterceptor: (request: any) => {
        // Add default headers for all requests
        request.headers['Content-Type'] = 'application/json';
        request.headers['Accept'] = 'application/json';
        return request;
      },
    },
  };

  // Setup Swagger UI middleware
  app.use('/docs', swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  console.log('📖 Swagger UI documentation available at: http://localhost:8788/docs');
  console.log('📄 OpenAPI JSON specification available at: http://localhost:8788/docs/openapi.json');
}