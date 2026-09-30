import { Request, Response } from 'express';
import { assistantService } from '../services/assistant/assistantService';

export const queryAssistant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, documentId } = req.body;

    if (!query || String(query).trim() === '') {
      res.status(400).json({
        success: false,
        error: { code: 'QUERY_REQUIRED', message: 'A text query is required for the AI Assistant.' }
      });
      return;
    }

    const result = await assistantService.query(query, documentId);

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'ASSISTANT_QUERY_FAILED', message: err.message }
    });
  }
};
