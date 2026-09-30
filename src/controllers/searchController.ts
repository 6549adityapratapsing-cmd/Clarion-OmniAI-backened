import { Request, Response } from 'express';
import { searchService } from '../services/search/searchService';

export const searchDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, type, supplier, status, minAmount, maxAmount, startDate, endDate } = req.query;

    const results = searchService.search({
      query: q ? String(q) : undefined,
      documentType: type ? String(type) : undefined,
      supplierName: supplier ? String(supplier) : undefined,
      status: status ? String(status) : undefined,
      minAmount: minAmount ? parseFloat(String(minAmount)) : undefined,
      maxAmount: maxAmount ? parseFloat(String(maxAmount)) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined
    });

    res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_FAILED', message: err.message }
    });
  }
};
