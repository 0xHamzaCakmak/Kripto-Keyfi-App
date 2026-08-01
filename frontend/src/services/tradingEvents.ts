import { api, apiUrl, getAccessToken } from './apiClient';

export type TradingEvent = {
  id: string;
  exchangeAccountId: string;
  topic: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type TradingStreamStatus = 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export function subscribeTradingEvents(
  exchangeAccountId: string,
  onEvent: (event: TradingEvent) => void,
  onStatus: (status: TradingStreamStatus) => void,
) {
  const controller = new AbortController();
  let cursor = '';

  void (async () => {
    let retryDelay = 1_000;
    onStatus('CONNECTING');
    while (!controller.signal.aborted) {
      try {
        let token = getAccessToken();
        if (!token) {
          await api.get('/admin/trading/overview');
          token = getAccessToken();
        }
        const query = new URLSearchParams({ exchangeAccountId, ...(cursor ? { cursor } : {}) });
        let response = await fetch(`${apiUrl}/admin/trading/events?${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (response.status === 401) {
          await api.get('/admin/trading/overview');
          token = getAccessToken();
          response = await fetch(`${apiUrl}/admin/trading/events?${query}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
          });
        }
        if (!response.ok || !response.body) throw new Error(`Trading stream ${response.status}`);
        onStatus('LIVE');
        retryDelay = 1_000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true }).replaceAll('\r\n', '\n');
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsed = parseEvent(block);
            if (parsed.id) cursor = parsed.id;
            if (parsed.event === 'trading' && parsed.data) onEvent(JSON.parse(parsed.data) as TradingEvent);
            boundary = buffer.indexOf('\n\n');
          }
        }
        if (!controller.signal.aborted) throw new Error('Trading stream closed');
      } catch (error) {
        if (controller.signal.aborted) break;
        onStatus('RECONNECTING');
        await wait(retryDelay, controller.signal).catch(() => undefined);
        retryDelay = Math.min(retryDelay * 2, 15_000);
      }
    }
    onStatus('OFFLINE');
  })();

  return () => controller.abort();
}

function parseEvent(block: string) {
  let event = 'message'; let id = ''; const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return { event, id, data: data.length ? data.join('\n') : undefined };
}

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  });
}
