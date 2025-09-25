/**
 * Main server entry point for the Gitdata overlay application
 */
import express from 'express';

import { setupSwaggerUI } from './docs/swagger-setup';
import { auditLogger } from './middleware/audit';
import { rateLimit, limitsMiddleware } from './middleware/limits';
import { metricsMiddleware } from './middleware/metrics';
import { advisoriesRouter } from './routes/advisories';
import { agentMarketplaceRouter } from './routes/agent-marketplace';
import { agentsRouter } from './routes/agents';
import { artifactsRouter } from './routes/artifacts';
import { bundleRouter } from './routes/bundle';
import { catalogRouter } from './routes/catalog';
import { d06AgentPaymentsRouter } from './routes/d06-agent-payments';
import { d06PaymentProcessingRouter } from './routes/d06-payment-processing';
import { d06RevenueManagementRouter } from './routes/d06-revenue-management';
import d07StreamingQuotasRouter from './routes/d07-streaming-quotas';
import { d22OverlayStorageRouter } from './routes/d22-overlay-storage';
import createD21Routes from './d21/routes.js';
import { dataRouter } from './routes/data';
import { healthRouter } from './routes/health';
import { identityRouter } from './routes/identity';
import { jobsRouter } from './routes/jobs';
import { listingsRouter } from './routes/listings';
import { metricsRouter } from './routes/metrics';
import { openlineageRouter } from './routes/openlineage';
import { overlayRouter } from './routes/overlay';
import { overlayBrcRouter } from './routes/overlay-brc';
import { enhancedBRC31OverlayRouter } from './routes/overlay-brc-31';
import { payRouter } from './routes/pay';
import { paymentsRouter } from './routes/payments';
import { priceRouter } from './routes/price';
import { producerRouter } from './routes/producer';
import { producersRouter } from './routes/producers';
import { producersRegisterRouter } from './routes/producers-register';
import { readyRouter } from './routes/ready';
import { rulesRouter } from './routes/rules';
import { storageRouter } from './routes/storage';
import { streamingMarketRouter } from './routes/streaming-market';
import { submitBuilderRouter } from './routes/submit-builder';
import { submitReceiverRouterWrapper } from './routes/submit-receiver';
import { templatesRouter } from './routes/templates';
import { walletRouter } from './routes/wallet';

const app = express();
const PORT = process.env.PORT || 8788;

// Basic CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Global middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from UI build directory
app.use(express.static('./ui/build'));

// Request logging and metrics
app.use(auditLogger());
app.use(metricsMiddleware());
app.use(limitsMiddleware());

// D20 Phase 1: Setup API documentation
setupSwaggerUI(app);

// Health and readiness checks
const healthRouterInstance = healthRouter();
app.use(healthRouterInstance);
app.use(readyRouter());

// Add health endpoint aliases for CLI compatibility
app.use('/v1', healthRouterInstance);  // Makes /v1/health available
app.use('/overlay', healthRouterInstance);  // Makes /overlay/health available

// Add status endpoint aliases that serve health data directly
app.get('/v1/status', async (req, res) => {
  // Forward the request to the health endpoint handler
  req.url = '/health';
  const healthRouterInstance = healthRouter();
  healthRouterInstance(req, res, () => {});
});

app.get('/overlay/status', async (req, res) => {
  // Forward the request to the health endpoint handler
  req.url = '/health';
  const healthRouterInstance = healthRouter();
  healthRouterInstance(req, res, () => {});
});

// Core data routes
app.use('/v1', dataRouter());
app.use('/v1', bundleRouter());
app.use('/v1', priceRouter());
app.use('/v1', payRouter());
app.use('/v1', advisoriesRouter());
app.use('/v1', catalogRouter());
app.use('/v1', metricsRouter());

// Producer and identity management
app.use('/v1', producersRouter());
app.use('/v1', producersRegisterRouter());
// app.use('/v1', identityRouter()); // Temporarily disabled

// Payment processing
app.use('/v1', paymentsRouter());
app.use('/v1', d06PaymentProcessingRouter());
app.use('/v1', d06AgentPaymentsRouter());
app.use('/v1', d06RevenueManagementRouter());

// D21 routes will be mounted after database initialization

// Storage and file management
app.use('/v1', storageRouter());
app.use('/v1', d22OverlayStorageRouter());
app.use('/v1', artifactsRouter());

// Templating and workflow
app.use('/v1', templatesRouter());
app.use('/v1', walletRouter());

// Overlay network integration
app.use('/v1', overlayRouter().router);
app.use('/v1', overlayBrcRouter().router);

// BRC-31 Enhanced Overlay Integration (initialize after database setup)
let brc31Router: any = null;
app.use('/v1', submitBuilderRouter());
app.use('/v1', submitReceiverRouterWrapper());

// Data lineage and provenance
app.use('/v1', openlineageRouter());
app.use('/v1', listingsRouter());

// Streaming and real-time data
app.use('/v1/streaming', rateLimit('streaming'), d07StreamingQuotasRouter);
try {
  console.log('🔄 Loading streaming market router...');
  const smRouter = streamingMarketRouter();
  console.log('✅ Streaming market router loaded:', typeof smRouter);
  console.log('🔗 Mounting streaming market at /v1/streaming-market');
  app.use('/v1/streaming-market', smRouter);
  console.log('✅ Streaming market router mounted');
} catch (error) {
  console.error('❌ Error loading streaming market router:', error);
}
app.use('/v1/producer', producerRouter());

// Agent marketplace
app.use('/v1/agent-marketplace', agentMarketplaceRouter().router);

// D24 BSV Overlay Network Agent Management
app.use('/agents', agentsRouter());
app.use('/rules', rulesRouter());
app.use('/jobs', jobsRouter());
app.use('/templates', templatesRouter());

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
      message: 'The request payload exceeds the maximum allowed size',
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Catch-all handler - serve index.html for SPA routes
app.get('*', (req: express.Request, res: express.Response) => {
  // If it's an API route that doesn't exist, return 404 JSON
  if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  }

  // For all other routes, serve the SPA
  res.sendFile('./ui/build/index.html', { root: '.' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Initialize BRC-31 services
async function initializeBRC31Services() {
  try {
    // Import BRC-31 and BRC-41 services
    const { initializeBRC31Middleware } = await import('./brc31/middleware');
    const { initializeBRC41PaymentMiddleware } = await import('./brc41/middleware');
    const { Pool } = await import('pg');
    const { initializeOverlayServices } = await import('./overlay/index');

    // Create PostgreSQL pool
    const dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'gitdata',
      user: process.env.DB_USER || 'gitdata',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    // Initialize overlay services (includes database adapter)
    const overlayServices = await initializeOverlayServices(
      dbPool,
      (process.env.NODE_ENV as any) || 'development',
      process.env.DOMAIN_NAME || 'localhost:8788',
    );

    // Initialize BRC-31 middleware
    const brc31Middleware = initializeBRC31Middleware({
      database: {
        query: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows;
          } finally {
            client.release();
          }
        },
        queryOne: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows[0] || null;
          } finally {
            client.release();
          }
        },
        execute: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            await client.query(sql, params);
          } finally {
            client.release();
          }
        },
      },
      enabled: process.env.BRC31_ENABLED !== 'false',
      serverPrivateKey: process.env.BRC31_SERVER_PRIVATE_KEY,
    });

    await brc31Middleware.initialize();

    // Initialize BRC-41 payment middleware
    const brc41PaymentMiddleware = initializeBRC41PaymentMiddleware({
      database: {
        query: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows;
          } finally {
            client.release();
          }
        },
        queryOne: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows[0] || null;
          } finally {
            client.release();
          }
        },
        execute: async (sql: string, params: any[] = []) => {
          const client = await dbPool.connect();
          try {
            await client.query(sql, params);
          } finally {
            client.release();
          }
        },
      },
      serverPrivateKey:
        process.env.BRC41_SERVER_PRIVATE_KEY || process.env.BRC31_SERVER_PRIVATE_KEY,
      enabled: process.env.BRC41_ENABLED !== 'false',
    });

    await brc41PaymentMiddleware.initialize();

    // Create BRC-31 enhanced router
    const brc31RouterInstance = enhancedBRC31OverlayRouter();
    brc31RouterInstance.setOverlayServices?.(overlayServices);

    // Mount BRC-31 router
    app.use('/overlay', brc31RouterInstance.router);

    // Initialize D21 BSV Native Payment Extensions
    const databaseAdapter = {
      query: async (sql: string, params: any[] = []) => {
        const client = await dbPool.connect();
        try {
          const result = await client.query(sql, params);
          return result.rows;
        } finally {
          client.release();
        }
      },
      queryOne: async (sql: string, params: any[] = []) => {
        const client = await dbPool.connect();
        try {
          const result = await client.query(sql, params);
          return result.rows[0] || null;
        } finally {
          client.release();
        }
      },
      execute: async (sql: string, params: any[] = []) => {
        const client = await dbPool.connect();
        try {
          await client.query(sql, params);
        } finally {
          client.release();
        }
      },
      getClient: async () => {
        return await dbPool.connect();
      },
    };

    // Mount D21 routes
    const d21Routes = createD21Routes(databaseAdapter);
    app.use('/v1/d21', d21Routes);

    console.log('✅ BRC-31 authentication services initialized');
    console.log('✅ BRC-41 payment services initialized');
    console.log('✅ D21 BSV Native Payment Extensions initialized');
    console.log('✅ Enhanced BRC-31 overlay endpoints available at /overlay');
    console.log(`✅ Database schema initialized for identity tracking`);
    console.log(`✅ Database schema initialized for payment tracking`);

    return { overlayServices, brc31Middleware, brc41PaymentMiddleware };
  } catch (error) {
    console.error('❌ Failed to initialize BRC-31/BRC-41 services:', error);
    console.log('⚠️  Continuing without BRC-31 authentication');
    return null;
  }
}

// Start server with BRC-31 initialization
const server = app.listen(PORT, async () => {
  console.log(`🚀 Gitdata overlay server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API docs: http://localhost:${PORT}/v1/docs`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize BRC-31 services asynchronously
  const brc31Services = await initializeBRC31Services();
  if (brc31Services) {
    console.log('🔐 BRC-31 Authrite authentication enabled');
    console.log('💰 BRC-41 PacketPay payments enabled');
  }
});

export { app, server };
