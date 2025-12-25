import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-developer-token',
};

interface TableStats {
  table_name: string;
  row_count: number;
  total_size_bytes: number;
  index_size_bytes: number;
  toast_size_bytes: number;
  inserts: number;
  updates: number;
  deletes: number;
}

interface StorageBucketStats {
  bucket_name: string;
  file_count: number;
  total_size_bytes: number;
}

interface CompanyStats {
  company_id: string;
  company_name: string;
  messages_count: number;
  conversations_count: number;
  contacts_count: number;
  ai_agents_count: number;
  estimated_db_size_bytes: number;
}

interface SupabaseStats {
  database: {
    total_size_bytes: number;
    tables: TableStats[];
  };
  storage: {
    total_size_bytes: number;
    buckets: StorageBucketStats[];
  };
  companies: CompanyStats[];
  usage_logs: {
    database_reads: number;
    database_writes: number;
    storage_uploads: number;
    storage_downloads: number;
    edge_function_invocations: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify developer token
    const developerToken = req.headers.get('x-developer-token');
    if (!developerToken) {
      return new Response(JSON.stringify({ error: 'Developer token required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify developer token
    const { data: developer, error: authError } = await supabase
      .from('developer_auth')
      .select('id, email')
      .eq('id', developerToken)
      .single();

    if (authError || !developer) {
      return new Response(JSON.stringify({ error: 'Invalid developer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[supabase-stats] Fetching stats for developer: ${developer.email}`);

    // Parse date range from request
    const { startDate, endDate } = await req.json().catch(() => ({}));
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // 1. Get database table statistics using pg_stat_user_tables
    const { data: tableStatsRaw, error: tableStatsError } = await supabase.rpc('get_table_statistics');
    
    let tableStats: TableStats[] = [];
    if (!tableStatsError && tableStatsRaw) {
      tableStats = tableStatsRaw;
    } else {
      console.log('[supabase-stats] Could not fetch table statistics via RPC, using fallback');
      // Fallback: estimate from known tables
      const tables = ['messages', 'conversations', 'contacts', 'ai_agents', 'ai_usage_log', 'profiles'];
      for (const tableName of tables) {
        const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
        tableStats.push({
          table_name: tableName,
          row_count: count || 0,
          total_size_bytes: (count || 0) * 500, // Rough estimate
          index_size_bytes: 0,
          toast_size_bytes: 0,
          inserts: 0,
          updates: 0,
          deletes: 0
        });
      }
    }

    // 2. Get storage bucket statistics
    const buckets = ['avatars', 'company-logos', 'messages-media', 'whatsapp-media', 'kanban-attachments', 
                     'internal-notes-media', 'scheduled-messages-media', 'ai-agent-media', 'commercial-reports'];
    
    const bucketStats: StorageBucketStats[] = [];
    let totalStorageSize = 0;
    
    for (const bucketName of buckets) {
      try {
        const { data: files, error } = await supabase.storage.from(bucketName).list('', { limit: 1000 });
        if (!error && files) {
          let bucketSize = 0;
          // Get size by listing files (limited approach but works)
          for (const file of files) {
            if (file.metadata?.size) {
              bucketSize += file.metadata.size;
            }
          }
          bucketStats.push({
            bucket_name: bucketName,
            file_count: files.length,
            total_size_bytes: bucketSize
          });
          totalStorageSize += bucketSize;
        }
      } catch (e) {
        console.log(`[supabase-stats] Could not fetch stats for bucket ${bucketName}:`, e);
      }
    }

    // 3. Get company-level statistics
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('active', true);

    const companyStats: CompanyStats[] = [];
    
    if (companies) {
      for (const company of companies) {
        // Get counts for this company
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { count: conversationsCount } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { count: contactsCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { count: aiAgentsCount } = await supabase
          .from('ai_agents')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        // Estimate DB size: messages ~500 bytes, conversations ~200 bytes, contacts ~300 bytes
        const estimatedSize = 
          ((messagesCount || 0) * 500) + 
          ((conversationsCount || 0) * 200) + 
          ((contactsCount || 0) * 300);

        companyStats.push({
          company_id: company.id,
          company_name: company.name,
          messages_count: messagesCount || 0,
          conversations_count: conversationsCount || 0,
          contacts_count: contactsCount || 0,
          ai_agents_count: aiAgentsCount || 0,
          estimated_db_size_bytes: estimatedSize
        });
      }
    }

    // Sort companies by estimated size (highest first)
    companyStats.sort((a, b) => b.estimated_db_size_bytes - a.estimated_db_size_bytes);

    // 4. Get usage log aggregates
    const { data: usageLogs } = await supabase
      .from('supabase_usage_log')
      .select('resource_type, operation_type')
      .gte('created_at', start)
      .lte('created_at', end);

    const usageAggregates = {
      database_reads: 0,
      database_writes: 0,
      storage_uploads: 0,
      storage_downloads: 0,
      edge_function_invocations: 0
    };

    if (usageLogs) {
      for (const log of usageLogs) {
        if (log.resource_type === 'database') {
          if (log.operation_type === 'read') usageAggregates.database_reads++;
          if (log.operation_type === 'write') usageAggregates.database_writes++;
          if (log.operation_type === 'delete') usageAggregates.database_writes++;
        } else if (log.resource_type === 'storage') {
          if (log.operation_type === 'upload') usageAggregates.storage_uploads++;
          if (log.operation_type === 'download') usageAggregates.storage_downloads++;
        } else if (log.resource_type === 'edge_function') {
          usageAggregates.edge_function_invocations++;
        }
      }
    }

    // Calculate total database size
    const totalDbSize = tableStats.reduce((sum, t) => sum + t.total_size_bytes, 0);

    const stats: SupabaseStats = {
      database: {
        total_size_bytes: totalDbSize,
        tables: tableStats.slice(0, 20) // Top 20 tables
      },
      storage: {
        total_size_bytes: totalStorageSize,
        buckets: bucketStats
      },
      companies: companyStats.slice(0, 20), // Top 20 companies
      usage_logs: usageAggregates
    };

    console.log(`[supabase-stats] Stats fetched: ${tableStats.length} tables, ${bucketStats.length} buckets, ${companyStats.length} companies`);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[supabase-stats] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
