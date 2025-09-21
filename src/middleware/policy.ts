import type { Request, Response, NextFunction } from 'express';
 //import { listJobs, getTestDatabase, isTestEnvironment } from '../db';

// Policy configuration from environment
const RULES_MAX_CONCURRENCY = Number(process.env.RULES_MAX_CONCURRENCY || 10);
const AGENTS_MAX_PER_IP = Number(process.env.AGENTS_MAX_PER_IP || 5);
const JOBS_MAX_PENDING_PER_RULE = Number(process.env.JOBS_MAX_PENDING_PER_RULE || 3);

// In-memory tracking for rate limits and concurrency
const agentRegistrations = new Map<string, { count: number; lastReset: number }>();
const runningJobs = new Map<string, number>(); // ruleId -> count

// Reset agent registration counts every hour
const AGENT_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function resetExpiredCounts() {
  const now = Date.now();
  for (const [ip, data] of agentRegistrations.entries()) {
    if (now - data.lastReset > AGENT_RATE_WINDOW) {
      agentRegistrations.delete(ip);
    }
  }
}

export function enforceAgentRegistrationPolicy(testDb?: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip rate limiting only if explicitly disabled (not in tests that want to test rate limiting)
      if (process.env.DISABLE_RATE_LIMITING === 'true' && !req.headers['x-test-rate-limits']) {
        return next();
      }

      resetExpiredCounts();

      const clientIP = getClientIP(req);
      const now = Date.now();

      let ipData = agentRegistrations.get(clientIP);
      if (!ipData) {
        ipData = { count: 0, lastReset: now };
        agentRegistrations.set(clientIP, ipData);
      }

      // Reset if window expired
      if (now - ipData.lastReset > AGENT_RATE_WINDOW) {
        ipData.count = 0;
        ipData.lastReset = now;
      }

      if (ipData.count >= AGENTS_MAX_PER_IP) {
        return res.status(429).json({
          error: 'rate-limit-exceeded',
          message: `Maximum ${AGENTS_MAX_PER_IP} agent registrations per IP per hour`,
          retryAfter: Math.ceil((AGENT_RATE_WINDOW - (now - ipData.lastReset)) / 1000)
        });
      }

      // Increment counter on successful registration
      const originalSend = res.send;
      res.send = function(data) {
        if (res.statusCode < 300) {
          ipData!.count++;
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Policy enforcement error:', error);
      next(); // Don't block on policy errors
    }
  };
}

export function enforceRuleConcurrency(testDb?: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get appropriate database
      const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);

      // Skip concurrency limits if no database available (PostgreSQL mode)
      if (!db || (process.env.DISABLE_RATE_LIMITING === 'true' && !req.headers['x-test-rate-limits'])) {
        return next();
      }

      // Check overall running jobs count
      const runningJobsCount = listJobs(db, 'running').length;

      if (runningJobsCount >= RULES_MAX_CONCURRENCY) {
        return res.status(503).json({
          error: 'concurrency-limit-exceeded',
          message: `Maximum ${RULES_MAX_CONCURRENCY} concurrent jobs allowed`,
          currentRunning: runningJobsCount
        });
      }

      next();
    } catch (error) {
      console.error('Concurrency check error:', error);
      next(); // Don't block on policy errors
    }
  };
}

export function enforceJobCreationPolicy(testDb?: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get appropriate database
      const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);

      // Skip job creation limits if no database available (PostgreSQL mode) or explicitly disabled
      if (!db || (process.env.DISABLE_RATE_LIMITING === 'true' && !req.headers['x-test-rate-limits'])) {
        return next();
      }

      const ruleId = req.params.id || req.body?.ruleId;

      if (ruleId) {
        // Check pending jobs for this rule
        const pendingJobs = listJobs(db, 'queued').filter(job => job.rule_id === ruleId);

        if (pendingJobs.length >= JOBS_MAX_PENDING_PER_RULE) {
          return res.status(429).json({
            error: 'job-queue-limit-exceeded',
            message: `Maximum ${JOBS_MAX_PENDING_PER_RULE} pending jobs per rule`,
            ruleId,
            pendingCount: pendingJobs.length
          });
        }
      }

      next();
    } catch (error) {
      console.error('Job creation policy error:', error);
      next(); // Don't block on policy errors
    }
  };
}

export function enforceResourceLimits() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip resource limits only if explicitly disabled
    if (process.env.DISABLE_RATE_LIMITING === 'true' && !req.headers['x-test-resource-limits']) {
      return next();
    }

    // Check request size limits
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

    if (contentLength > MAX_REQUEST_SIZE) {
      return res.status(413).json({
        error: 'request-too-large',
        message: `Request size ${contentLength} exceeds maximum ${MAX_REQUEST_SIZE} bytes`,
        maxSize: MAX_REQUEST_SIZE
      });
    }

    // Check template content limits for contract templates
    if ((req.path.includes('/templates') || req.originalUrl.includes('/templates')) && req.body?.content) {
      const contentSize = Buffer.byteLength(req.body.content, 'utf8');
      const MAX_TEMPLATE_SIZE = 100 * 1024; // 100KB

      if (contentSize > MAX_TEMPLATE_SIZE) {
        return res.status(413).json({
          error: 'template-too-large',
          message: `Template content size ${contentSize} exceeds maximum ${MAX_TEMPLATE_SIZE} bytes`,
          maxSize: MAX_TEMPLATE_SIZE
        });
      }
    }

    next();
  };
}

// Enhanced security policy for agent marketplace
export function enforceAgentSecurityPolicy() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate webhook URLs
    if (req.body?.webhookUrl) {
      const url = req.body.webhookUrl;

      try {
        const parsed = new URL(url);

        // Always validate URL scheme (reject dangerous schemes)
        const allowedSchemes = ['http:', 'https:'];
        if (!allowedSchemes.includes(parsed.protocol)) {
          return res.status(400).json({
            error: 'invalid-webhook-url',
            message: 'Webhook URLs must use HTTP or HTTPS protocols'
          });
        }

        // Block localhost/private networks in production (and tests that want to test this)
        if (process.env.NODE_ENV === 'production' || req.headers['x-test-webhook-validation']) {
          const hostname = parsed.hostname;
          if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.2') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.')
          ) {
            return res.status(400).json({
              error: 'invalid-webhook-url',
              message: 'Webhook URLs cannot point to private networks in production'
            });
          }
        }

        // Require HTTPS in production (and tests that want to test this)
        if ((process.env.NODE_ENV === 'production' || req.headers['x-test-webhook-validation']) && parsed.protocol !== 'https:') {
          return res.status(400).json({
            error: 'invalid-webhook-url',
            message: 'Webhook URLs must use HTTPS in production'
          });
        }

      } catch (error) {
        return res.status(400).json({
          error: 'invalid-webhook-url',
          message: 'Invalid webhook URL format'
        });
      }
    }

    // Validate agent capabilities
    if (req.body?.capabilities && Array.isArray(req.body.capabilities)) {
      const capabilities = req.body.capabilities;
      const MAX_CAPABILITIES = 20;

      if (capabilities.length > MAX_CAPABILITIES) {
        return res.status(400).json({
          error: 'too-many-capabilities',
          message: `Maximum ${MAX_CAPABILITIES} capabilities allowed`,
          provided: capabilities.length
        });
      }

      // Validate capability names
      for (const cap of capabilities) {
        if (typeof cap !== 'string' || cap.length > 50 || !/^[a-zA-Z0-9._-]+$/.test(cap)) {
          return res.status(400).json({
            error: 'invalid-capability',
            message: 'Capability names must be alphanumeric strings under 50 characters',
            invalid: cap
          });
        }
      }
    }

    next();
  };
}

// Reset policy state for testing
export function resetPolicyState() {
  agentRegistrations.clear();
  runningJobs.clear();
}

// Policy metrics for monitoring
export function getPolicyMetrics(testDb?: Database.Database) {
  // Get appropriate database
  const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);

  if (!db) {
    // Return empty metrics for PostgreSQL mode
    return {
      jobs: { running: 0, queued: 0, failed: 0, dead: 0 },
      agentRegistrations: { totalIPs: 0, totalRegistrations: 0 },
      concurrency: { current: 0, max: RULES_MAX_CONCURRENCY }
    };
  }

  const runningJobs = listJobs(db, 'running').length;
  const queuedJobs = listJobs(db, 'queued').length;
  const failedJobs = listJobs(db, 'failed').length;
  const deadJobs = listJobs(db, 'dead').length;

  return {
    jobs: {
      running: runningJobs,
      queued: queuedJobs,
      failed: failedJobs,
      dead: deadJobs,
      maxConcurrency: RULES_MAX_CONCURRENCY,
      concurrencyUtilization: runningJobs / RULES_MAX_CONCURRENCY
    },
    agents: {
      maxPerIP: AGENTS_MAX_PER_IP,
      rateWindowHours: AGENT_RATE_WINDOW / (60 * 60 * 1000),
      activeRateLimits: agentRegistrations.size
    },
    limits: {
      maxRequestSize: 1024 * 1024,
      maxTemplateSize: 100 * 1024,
      maxPendingJobsPerRule: JOBS_MAX_PENDING_PER_RULE
    }
  };
}