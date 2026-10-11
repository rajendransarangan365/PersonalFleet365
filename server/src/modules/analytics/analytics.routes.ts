import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import * as AnalyticsController from './analytics.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

router.get('/dashboard', requirePermission('reports.view'), AnalyticsController.getDashboardKpis);
router.get('/fleet-performance', requirePermission('reports.view'), AnalyticsController.getFleetPerformance);
router.get('/revenue-trends', requirePermission('reports.view'), AnalyticsController.getRevenueTrends);

// Gemini Free Tier AI Depth Analysis & Chat
router.post('/ai-analysis', requirePermission('reports.view'), AnalyticsController.getAiDepthAnalysis);
router.post('/ai-chat', AnalyticsController.handleAiChat);
router.post('/ai-simulation-advisor', AnalyticsController.getAiSimulationAdvice);

export default router;
