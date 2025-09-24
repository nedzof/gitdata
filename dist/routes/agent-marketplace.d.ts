import { Router } from 'express';
import type { AgentExecutionService } from '../agents/agent-execution-service';
import type { OverlayAgentRegistry } from '../agents/overlay-agent-registry';
import type { OverlayRuleEngine } from '../agents/overlay-rule-engine';
export interface AgentMarketplaceRouter {
    router: Router;
    setServices?: (services: {
        agentRegistry: OverlayAgentRegistry;
        ruleEngine: OverlayRuleEngine;
        executionService: AgentExecutionService;
    }) => void;
}
export declare function agentMarketplaceRouter(): AgentMarketplaceRouter;
