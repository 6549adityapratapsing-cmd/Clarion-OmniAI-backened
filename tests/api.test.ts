import request from 'supertest';
import app from '../src/app';

describe('Clarion OmniAI API Endpoints', () => {
  it('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.services.api.status).toBe('HEALTHY');
    expect(res.body.services.database.status).toBe('HEALTHY');
  });

  it('GET /api/demo/scenarios returns the 10 golden demo scenarios', async () => {
    const res = await request(app).get('/api/demo/scenarios');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scenarios.length).toBe(10);
    expect(res.body.data.scenarios.some((s: any) => s.id === 'clean-invoice')).toBe(true);
  });

  it('POST /api/demo/load/:scenarioId processes a scenario document end-to-end', async () => {
    const res = await request(app).post('/api/demo/load/clean-invoice');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document).toBeDefined();
    expect(res.body.data.document.documentType).toBe('INVOICE');
    expect(res.body.data.fields.length).toBeGreaterThan(0);
    expect(res.body.data.validationResult.status).toBe('PASS');
  });

  it('POST /api/demo/load/:scenarioId flags math mismatch scenario', async () => {
    const res = await request(app).post('/api/demo/load/math-mismatch');
    expect(res.status).toBe(200);
    expect(res.body.data.document.decision).toBe('REVIEW_REQUIRED');
    expect(res.body.data.validationResult.ruleFailureCount).toBeGreaterThan(0);
  });
});
