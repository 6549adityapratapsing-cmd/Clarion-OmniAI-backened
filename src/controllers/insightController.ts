import { Request, Response } from 'express';
import { dataStore } from '../repositories/dataStore';
import { metricsService } from '../services/insights/metricsService';

export const listInsights = async (_req: Request, res: Response): Promise<void> => {
  try {
    const insights = Array.from(dataStore.insights.values());
    res.json({
      success: true,
      data: { insights }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_INSIGHTS_FAILED', message: err.message }
    });
  }
};

export const getDashboardMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const metrics = metricsService.getDashboardMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_METRICS_FAILED', message: err.message }
    });
  }
};
