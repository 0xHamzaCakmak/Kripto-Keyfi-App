import { createServer } from 'node:http';

const token = process.env.AI_OBSERVER_ACCEPTANCE_TOKEN?.trim();
if (!token || token.length < 32) throw new Error('AI_OBSERVER_ACCEPTANCE_TOKEN en az 32 karakter olmalı.');

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/observe') {
    response.writeHead(404).end();
    return;
  }
  if (request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(401).end();
    return;
  }
  let body = '';
  request.on('data', (chunk: Buffer) => {
    body += chunk.toString('utf8');
    if (body.length > 64 * 1024) request.destroy();
  });
  request.on('end', () => {
    const payload = JSON.parse(body) as { ruleDecision?: { action?: string }; constraints?: { executionAllowed?: boolean; comparisonOnly?: boolean } };
    if (payload.constraints?.executionAllowed !== false || payload.constraints.comparisonOnly !== true) {
      response.writeHead(422).end();
      return;
    }
    const action = ['HOLD', 'BUY', 'SELL'].includes(payload.ruleDecision?.action ?? '') ? payload.ruleDecision!.action : 'HOLD';
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ action, confidence: 0.74, rationale: 'Yerel kabul gözlemcisi kural yönünü karşılaştırma amacıyla doğruladı.', expiresInSeconds: 120 }));
  });
});

server.listen(8092, '127.0.0.1', () => console.log('AI observer acceptance stub ready: 127.0.0.1:8092'));
