/**
 * Main server entry point for the Gitdata overlay application
 */
import express from 'express';
import { healthRouter } from './routes/health';
import { readyRouter } from './routes/ready';
import { dataRouter } from './routes/data';
import { bundleRouter } from './routes/bundle';
import { priceRouter } from './routes/price';
import { payRouter } from './routes/pay';
import { advisoriesRouter } from './routes/advisories';
import { catalogRouter } from './routes/catalog';
import { metricsRouter } from './routes/metrics';
import { producersRouter } from './routes/producers';
import { paymentsRouter } from './routes/payments';
import { storageRouter } from './routes/storage';
import { templatesRouter } from './routes/templates';
import { artifactsRouter } from './routes/artifacts';
import { walletRouter } from './routes/wallet';
import { identityRouter } from './routes/identity';
import { overlayRouter } from './routes/overlay';
import { overlayBrcRouter } from './routes/overlay-brc';
import { listingsRouter } from './routes/listings';
import { openlineageRouter } from './routes/openlineage';
import { submitBuilderRouter } from './routes/submit-builder';
import { submitReceiverRouterWrapper } from './routes/submit-receiver';
import { producersRegisterRouter } from './routes/producers-register';
import { d22OverlayStorageRouter } from './routes/d22-overlay-storage';
import { d06PaymentProcessingRouter } from './routes/d06-payment-processing';
import { d06AgentPaymentsRouter } from './routes/d06-agent-payments';
import { d06RevenueManagementRouter } from './routes/d06-revenue-management';
import d07StreamingQuotasRouter from './routes/d07-streaming-quotas';
import { agentMarketplaceRouter } from './routes/agent-marketplace';
import { producerRouter } from './routes/producer';
import { streamingMarketRouter } from './routes/streaming-market';
import { agentsRouter } from './routes/agents';
import { rulesRouter } from './routes/rules';
import { jobsRouter } from './routes/jobs';
import { auditLogger } from './middleware/audit';
import { metricsMiddleware } from './middleware/metrics';
import { rateLimit, limitsMiddleware } from './middleware/limits';

const app = express();
const PORT = process.env.PORT || 8788;

// Basic CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
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

// Health and readiness checks
app.use(healthRouter());
app.use(readyRouter());

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
      message: 'The request payload exceeds the maximum allowed size'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Catch-all handler - serve index.html for SPA routes
app.get('*', (req: express.Request, res: express.Response) => {
  // If it's an API route that doesn't exist, return 404 JSON
  if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.originalUrl} not found`
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Gitdata overlay server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API docs: http://localhost:${PORT}/v1/docs`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server };