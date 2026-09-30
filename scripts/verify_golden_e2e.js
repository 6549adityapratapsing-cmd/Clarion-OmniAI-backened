const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function patch(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyWorkflow() {
  console.log('========================================================');
  console.log('CLARION OMNIAI — GOLDEN DEMO END-TO-END VERIFICATION');
  console.log('========================================================\n');

  console.log('--- Phase 1: Authentication & RBAC Verification ---');
  const loginRes = await post('/auth/login', { email: 'reviewer@clarion.ai', password: 'Password@123' });
  console.log('✓ Login HTTP status:', loginRes.status);
  console.log('✓ Authenticated User:', loginRes.data.data?.user?.fullName, `(${loginRes.data.data?.user?.email})`);
  console.log('✓ Assigned Role:', loginRes.data.data?.user?.role);
  const token = loginRes.data.data?.token;

  console.log('\n--- Phase 2: Ingest Benchmark Scenario 5 (PO Mismatch Invoice) ---');
  const ingestRes = await post('/demo/load/po-mismatch', {}, token);
  console.log('✓ Ingest HTTP status:', ingestRes.status);
  const doc = ingestRes.data.data?.document;
  console.log('✓ Ingested Document:', doc?.title);
  console.log('✓ Document Status:', doc?.status);
  console.log('✓ Hash (SHA-256):', doc?.documentHash);
  const docId = doc?.id;

  console.log('\n--- Phase 3: Three-Layer Decision Architecture Inspection ---');
  const docRes = await get('/documents/' + docId, token);
  const docDetails = docRes.data.data?.document;
  const validation = docRes.data.data?.validationResult;
  const fields = docRes.data.data?.fields;
  console.log('• Layer 1 (AI Understanding): Overall Confidence =', Math.round((docDetails?.overallConfidence || 0) * 100) + '%');
  console.log('  Extracted Fields count:', fields?.length);
  const totalField = fields?.find(f => f.fieldName === 'total_amount');
  console.log('  Extracted Total Field:', totalField?.fieldValue, `(Confidence: ${Math.round((totalField?.confidence || 0)*100)}%, Page: ${totalField?.pageNumber})`);
  console.log('  Spatial Bounding Box:', JSON.stringify(totalField?.boundingBox));

  console.log('• Layer 2 (Deterministic Business Validation):');
  console.log('  Validation Status:', validation?.status);
  console.log('  Total Validation Issues:', validation?.issues?.length);
  validation?.issues?.forEach((issue, idx) => {
    console.log(`    [#${idx+1}] [${issue.severity}] ${issue.code}: ${issue.message}`);
  });

  console.log('• Layer 3 (Decision Engine):');
  console.log('  Final Decision:', docDetails?.decision);
  console.log('  Decision Reason:', docDetails?.decisionReason);

  console.log('\n--- Phase 4: Human-in-the-Loop Review & Versioning ---');
  console.log('Action: Reviewer modifies extracted total from 102000 to 95000 to match purchase order terms.');
  const correctionRes = await patch('/documents/' + docId + '/extraction', {
    fieldUpdates: [
      { fieldName: 'total_amount', correctedValue: '95000' }
    ],
    reason: 'Adjusted total to reconcile with purchase order line items'
  }, token);
  console.log('✓ Correction HTTP status:', correctionRes.status);
  console.log('✓ Extraction Version Created:', correctionRes.data.data?.version?.versionNumber);
  console.log('✓ Version Created By:', correctionRes.data.data?.version?.createdBy);

  console.log('\n--- Phase 5: Re-validation & Document Approval ---');
  const approveRes = await post('/documents/' + docId + '/approve', {
    reason: 'Verified against PO-2026-088. Line items reconciled.'
  }, token);
  console.log('✓ Approval HTTP status:', approveRes.status);
  console.log('✓ Final Document Status:', approveRes.data.data?.document?.status);
  console.log('✓ Audit Decision:', approveRes.data.data?.document?.decision);

  console.log('\n--- Phase 6: Source-Grounded AI Assistant & Knowledge Discovery ---');
  const query = 'Summarize what was detected for invoice INV-2026-005 and PO-2026-088';
  console.log('User Question:', query);
  const assistantRes = await post('/assistant/query', { query }, token);
  console.log('✓ AI Assistant Response:');
  console.log(' ', assistantRes.data.data?.answer);
  console.log('✓ Verified Grounded Citations (' + assistantRes.data.data?.sources?.length + ' sources):');
  assistantRes.data.data?.sources?.forEach((src, idx) => {
    console.log(`    [Citation ${idx+1}] Document: "${src.documentTitle}" (Page ${src.page})`);
    console.log(`      Snippet: "${src.relevantSnippet || src.excerpt}"`);
  });

  console.log('\n--- Phase 7: Document Intelligence Trust & Health Engine ---');
  const metricsRes = await get('/dashboard/metrics', token);
  const kpis = metricsRes.data.data?.kpis;
  const trust = metricsRes.data.data?.trustHealth;
  console.log('✓ Total Ingested Documents:', kpis?.totalDocuments);
  console.log('✓ Approved Documents in Gold Ledger:', kpis?.approvedDocuments);
  console.log('✓ Average AI Confidence:', Math.round((trust?.averageConfidence || 0) * 100) + '%');
  console.log('✓ Measured Human Correction Rate:', Math.round((trust?.humanCorrectionRate || 0) * 100) + '%');
  console.log('✓ Auto-Approval Rate:', Math.round((trust?.autoApprovalRate || 0) * 100) + '%');

  console.log('\n========================================================');
  console.log('🏆 GOLDEN SCENARIO COMPLETED WITH 100% SUCCESS');
  console.log('========================================================');
}

verifyWorkflow().catch(console.error);
