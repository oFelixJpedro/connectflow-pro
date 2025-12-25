// Supabase Usage Tracker - Logs Supabase resource usage
// Tracks: database operations, storage, edge functions, realtime

export type ResourceType = 'database' | 'storage' | 'edge_function' | 'realtime' | 'auth';
export type OperationType = 'read' | 'write' | 'delete' | 'invoke' | 'upload' | 'download';

interface UsageDetails {
  tableName?: string;
  functionName?: string;
  bucketName?: string;
  rowCount?: number;
  bytesProcessed?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Log Supabase resource usage to the database
 * @param supabaseClient - Supabase client instance
 * @param companyId - Company ID (optional, can be null for system operations)
 * @param resourceType - Type of resource (database, storage, edge_function, etc.)
 * @param operationType - Type of operation (read, write, delete, etc.)
 * @param details - Additional details about the operation
 */
export async function logSupabaseUsage(
  supabaseClient: any,
  companyId: string | null,
  resourceType: ResourceType,
  operationType: OperationType,
  details: UsageDetails = {}
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('supabase_usage_log')
      .insert({
        company_id: companyId,
        resource_type: resourceType,
        operation_type: operationType,
        table_name: details.tableName,
        function_name: details.functionName,
        bucket_name: details.bucketName,
        row_count: details.rowCount || 0,
        bytes_processed: details.bytesProcessed || 0,
        duration_ms: details.durationMs || 0,
        metadata: details.metadata || {}
      });

    if (error) {
      console.error('[SupabaseUsageTracker] Error logging usage:', error);
    } else {
      console.log(`[SupabaseUsageTracker] Logged: ${resourceType}/${operationType} | ${details.tableName || details.functionName || details.bucketName || 'system'}`);
    }
  } catch (e) {
    console.error('[SupabaseUsageTracker] Exception:', e);
  }
}

/**
 * Calculate approximate bytes for a database row based on content
 */
export function estimateRowBytes(row: Record<string, any>): number {
  const jsonStr = JSON.stringify(row);
  // UTF-8 encoding: ~1 byte per ASCII char, more for special chars
  return jsonStr.length * 1.2; // Add 20% overhead for Postgres storage
}

/**
 * Wrap a database operation with usage logging
 */
export async function withDbLogging<T>(
  supabaseClient: any,
  companyId: string | null,
  operationType: OperationType,
  tableName: string,
  operation: () => Promise<{ data: T | null; error: any; count?: number }>
): Promise<{ data: T | null; error: any; count?: number }> {
  const startTime = Date.now();
  const result = await operation();
  const durationMs = Date.now() - startTime;
  
  // Only log successful operations
  if (!result.error) {
    const rowCount = result.count || (Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0);
    const bytesProcessed = result.data ? estimateRowBytes(result.data as Record<string, any>) : 0;
    
    await logSupabaseUsage(supabaseClient, companyId, 'database', operationType, {
      tableName,
      rowCount,
      bytesProcessed,
      durationMs
    });
  }
  
  return result;
}

/**
 * Log storage operation
 */
export async function logStorageUsage(
  supabaseClient: any,
  companyId: string | null,
  operationType: 'upload' | 'download' | 'delete',
  bucketName: string,
  bytesProcessed: number = 0
): Promise<void> {
  await logSupabaseUsage(supabaseClient, companyId, 'storage', operationType, {
    bucketName,
    bytesProcessed,
    rowCount: 1
  });
}

/**
 * Log edge function invocation
 */
export async function logEdgeFunctionUsage(
  supabaseClient: any,
  companyId: string | null,
  functionName: string,
  durationMs: number = 0,
  metadata: Record<string, any> = {}
): Promise<void> {
  await logSupabaseUsage(supabaseClient, companyId, 'edge_function', 'invoke', {
    functionName,
    durationMs,
    rowCount: 1,
    metadata
  });
}
