import { createClient } from '@supabase/supabase-js';
// Service-role: bypasses RLS. Server-only. Used for host resolution +
// provisioning, never exposed to the browser.
//
// We pass a no-op WebSocket stub to the realtime option so that supabase-js
// doesn't call WebSocketFactory.getWebSocketConstructor(), which throws on
// Node < 22 (no native WebSocket). We never use the Realtime channel here;
// all access is via the PostgREST REST client (supabaseAdmin.from(...)).
class _NoopWS {
  constructor(_url: string, _protocols?: string | string[]) {}
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    realtime: { transport: _NoopWS as unknown as typeof WebSocket },
  },
);
