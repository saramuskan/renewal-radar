
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp/server.js';
import { timingSafeEqual } from 'node:crypto';
const app = express();
const PORT = process.env.PORT || 3000;
// Protect dashboard and API routes with Basic Authentication
app.use((req, res, next) => {
  // Keep MCP authentication separate
  if (req.path === '/mcp' || req.path === '/api/health' || req.method === 'OPTIONS') {
    return next();
  }

  const username = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password) {
    return res.status(500).send('Dashboard authentication is not configured.');
  }

  const auth = req.headers.authorization;

  if (!auth?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="RenewalRadar"');
    return res.status(401).send('Authentication required.');
  }

  try {
    const expected = Buffer.from(`${username}:${password}`);
    const provided = Buffer.from(auth.slice(6), 'base64');

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      res.setHeader('WWW-Authenticate', 'Basic realm="RenewalRadar"');
      return res.status(401).send('Invalid credentials.');
    }

    next();
  } catch {
    return res.status(401).send('Invalid credentials.');
  }
});


app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'RenewalRadar' });
});

// Get all subscriptions
app.get('/api/subscriptions', async (_req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('renewal_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a subscription
app.post('/api/subscriptions', async (req, res) => {
  const { name, vendor, amount, renewal_date } = req.body;

  if (!name || !vendor || amount === undefined || !renewal_date) {
    return res.status(400).json({
      error: 'Name, vendor, amount and renewal date are required.'
    });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Edit a subscription
app.patch('/api/subscriptions/:id', async (req, res) => {
  const id = String(req.params.id);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a subscription
app.delete('/api/subscriptions/:id', async (req, res) => {
  const id = String(req.params.id);

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});


// Claude MCP endpoint
app.post('/mcp', async (req, res) => {
      const expectedToken = process.env.MCP_ACCESS_TOKEN;
  const apiKeyHeader = req.headers['x-api-key'];
const mcpTokenHeader = req.headers['x-mcp-token'];
const authHeader = req.headers.authorization;

const providedToken =
  typeof apiKeyHeader === 'string'
    ? apiKeyHeader
    : typeof mcpTokenHeader === 'string'
      ? mcpTokenHeader
      : authHeader;

  if (!expectedToken) {
    console.error('MCP_ACCESS_TOKEN is not configured.');
    return res.status(500).json({ error: 'Server authentication is not configured.' });
  }

 if (
  providedToken !== `Bearer ${expectedToken}` &&
  providedToken !== expectedToken
) {
  return res.status(401).json({ error: 'Unauthorized' });
}
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });


  const mcpServer = createMcpServer();

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP request failed' });
    }
  }
});

// This MVP uses stateless HTTP, so GET and DELETE are not supported.
app.get('/mcp', (_req, res) => {
  res.status(405).send('Use POST for MCP requests.');
});

app.delete('/mcp', (_req, res) => {
  res.status(405).send('MCP sessions are not enabled.');
});

app.listen(PORT, () => {
  console.log(`RenewalRadar running at http://localhost:${PORT}`);
});
