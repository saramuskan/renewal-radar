
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

export function createMcpServer() {
  const server = new McpServer({
    name: 'renewal-radar',
    version: '1.0.0'
  });

  // TOOL 1: Add a subscription
  server.registerTool(
    'add_subscription',
    {
      title: 'Add Subscription',
      description: 'Add a new business subscription to RenewalRadar.',
      inputSchema: {
        name: z.string().min(1),
        vendor: z.string().min(1),
        amount: z.number().nonnegative(),
        renewal_date: z.string(),
        billing_cycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
        team: z.string().optional(),
        notes: z.string().optional()
      }
    },
    async (input) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(input)
        .select()
        .single();

      if (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Subscription added successfully:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    }
  );

  // TOOL 2: List subscriptions
  server.registerTool(
    'list_subscriptions',
    {
      title: 'List Subscriptions',
      description: 'Retrieve all subscriptions stored in RenewalRadar.',
      inputSchema: {}
    },
    async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('renewal_date', { ascending: true });

      if (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // TOOL 3: Update a subscription
  server.registerTool(
    'update_subscription',
    {
      title: 'Update Subscription',
      description: 'Update an existing subscription using its subscription ID.',
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().optional(),
        vendor: z.string().optional(),
        amount: z.number().nonnegative().optional(),
        renewal_date: z.string().optional(),
        billing_cycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
        team: z.string().optional(),
        status: z.enum(['active', 'cancelled']).optional(),
        notes: z.string().optional()
      }
    },
    async ({ id, ...updates }) => {
      const changes = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      );

      if (Object.keys(changes).length === 0) {
        return {
          content: [{ type: 'text', text: 'Please provide at least one field to update.' }],
          isError: true
        };
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          ...changes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Subscription updated successfully:\n${JSON.stringify(data, null, 2)}`
        }]
      };
    }
  );

  return server;
}
