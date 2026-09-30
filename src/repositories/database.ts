import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabaseClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

if (config.supabaseUrl && config.supabaseServiceRoleKey) {
  try {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ Supabase Client initialized with Service Role Key');
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase admin client:', err);
  }
}

if (config.supabaseUrl && config.supabaseAnonKey) {
  try {
    supabaseAnonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ Supabase Anon Client initialized for Public Auth');
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase anon client:', err);
  }
}

if (!supabaseClient) {
  console.log('ℹ️ Running with embedded high-performance Data Store (Self-contained mode)');
}

export { supabaseClient, supabaseAnonClient };
