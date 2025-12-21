/**
 * Módulo compartilhado para cache de análise de mídias
 * Usado por: ai-agent-process, evaluate-conversation, generate-filtered-insights
 */

// Gera hash SHA-256 de uma string (para usar como cache key)
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Busca análise cacheada de uma mídia
export async function getCachedAnalysis(
  supabase: any,
  url: string,
  companyId: string
): Promise<any | null> {
  try {
    const urlHash = await sha256(url);
    
    const { data, error } = await supabase
      .from('media_analysis_cache')
      .select('analysis_result')
      .eq('url_hash', urlHash)
      .eq('company_id', companyId)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    // Incrementa hit count (fire and forget)
    supabase.rpc('increment_cache_hit', { 
      p_url_hash: urlHash, 
      p_company_id: companyId 
    }).catch(() => {});
    
    console.log(`[MediaCache] HIT for ${url.substring(0, 50)}...`);
    return data.analysis_result;
  } catch (e) {
    console.error('[MediaCache] Error getting cached analysis:', e);
    return null;
  }
}

// Salva análise de mídia no cache
export async function saveCacheAnalysis(
  supabase: any,
  url: string,
  companyId: string,
  mediaType: string,
  result: any,
  ttlDays: number = 7
): Promise<void> {
  try {
    const urlHash = await sha256(url);
    
    await supabase
      .from('media_analysis_cache')
      .upsert({
        url_hash: urlHash,
        url,
        company_id: companyId,
        media_type: mediaType,
        analysis_result: result,
        expires_at: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'url_hash,company_id' });
    
    console.log(`[MediaCache] SAVED for ${url.substring(0, 50)}...`);
  } catch (error) {
    console.error('[MediaCache] Error saving:', error);
  }
}

// Helper para converter ArrayBuffer para Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Transcreve áudio usando Gemini (ainda usa Base64 pois é obrigatório para áudio)
export async function transcribeAudio(
  audioUrl: string, 
  apiKey: string,
  supabase?: any,
  companyId?: string
): Promise<string | null> {
  try {
    // Verifica cache primeiro se disponível
    if (supabase && companyId) {
      const cached = await getCachedAnalysis(supabase, audioUrl, companyId);
      if (cached?.transcription) {
        console.log(`[TranscribeAudio] Cache HIT: ${cached.transcription.substring(0, 50)}...`);
        return cached.transcription;
      }
    }
    
    console.log(`[TranscribeAudio] Downloading and transcribing: ${audioUrl.substring(0, 50)}...`);
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`[TranscribeAudio] Failed to fetch audio: ${audioResponse.status}`);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Normaliza MIME type
    let mimeType = 'audio/ogg';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) mimeType = 'audio/mp3';
    else if (contentType.includes('wav')) mimeType = 'audio/wav';
    else if (contentType.includes('webm')) mimeType = 'audio/webm';
    else if (contentType.includes('m4a') || contentType.includes('mp4')) mimeType = 'audio/mp4';
    else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Audio } },
              { text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação ou comentários." }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );
    
    if (!response.ok) {
      console.error(`[TranscribeAudio] Gemini error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (transcription) {
      console.log(`[TranscribeAudio] Success: ${transcription.substring(0, 50)}...`);
      
      // Salva no cache se disponível
      if (supabase && companyId) {
        saveCacheAnalysis(supabase, audioUrl, companyId, 'audio', { transcription })
          .catch(err => console.error('[TranscribeAudio] Cache save error:', err));
      }
      
      return transcription;
    }
    
    return null;
  } catch (error) {
    console.error('[TranscribeAudio] Error:', error);
    return null;
  }
}

// Tipos de documento suportados pelo Gemini
export const SUPPORTED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/markdown', 'text/rtf',
  'application/rtf', 'application/x-javascript', 'text/javascript',
  'application/json', 'text/xml', 'application/xml'
];

// Tipos de vídeo suportados pelo Gemini
export const SUPPORTED_VIDEO_MIMES = [
  'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv',
  'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska'
];

// Repara JSON truncado (comum em respostas longas)
export function repairTruncatedJson(text: string): string {
  let cleaned = text.trim();
  
  // Remove markdown code blocks se existirem
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  
  // Se não termina com }, tenta reparar
  if (!cleaned.endsWith('}')) {
    console.warn('[JSONRepair] JSON appears truncated, attempting repair');
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/]/g) || []).length;
    
    // Fecha arrays primeiro, depois objetos
    cleaned += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    cleaned += '}'.repeat(Math.max(0, openBraces - closeBraces));
  }
  
  return cleaned;
}

// Extrai JSON de texto que pode conter markdown ou texto extra
export function extractJson(text: string): string | null {
  let t = text.trim();
  
  // Remove possíveis blocos de markdown
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) t = fenced[1].trim();
  
  // Extrai do primeiro "{" até o último "}"
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  
  return t.slice(start, end + 1).trim();
}

// Infere MIME type do nome do arquivo
export function inferMimeTypeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'html': 'text/html',
    'htm': 'text/html',
    'md': 'text/markdown',
    'rtf': 'application/rtf',
    'json': 'application/json',
    'xml': 'application/xml',
    'js': 'application/x-javascript',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mp3': 'audio/mp3',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
  };
  
  return ext ? mimeMap[ext] || null : null;
}
