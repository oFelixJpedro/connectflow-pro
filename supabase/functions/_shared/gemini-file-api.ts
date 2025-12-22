/**
 * Gemini File API Module
 * 
 * Usa a File API do Gemini para análise de mídias:
 * - Suporta: imagens, vídeos, áudios, documentos
 * - Limite: 2GB por arquivo, 20GB total por projeto
 * - Retenção: 48 horas (auto-deletado pelo Gemini)
 * - Sem custo adicional além dos tokens
 */

import { getCachedAnalysis, saveCacheAnalysis, sha256 } from "./media-cache.ts";

// MIME types suportados pela Gemini File API
export const SUPPORTED_MIME_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/gif'],
  video: ['video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  audio: ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm', 'audio/mp4'],
  document: ['application/pdf', 'text/plain', 'text/html', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/rtf', 'text/javascript', 'text/x-python', 'text/xml', 'application/xml', 'text/markdown']
};

// Infere o tipo de mídia a partir do MIME type
export function inferMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' | null {
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  
  if (SUPPORTED_MIME_TYPES.image.includes(mime) || mime.startsWith('image/')) return 'image';
  if (SUPPORTED_MIME_TYPES.video.includes(mime) || mime.startsWith('video/')) return 'video';
  if (SUPPORTED_MIME_TYPES.audio.includes(mime) || mime.startsWith('audio/')) return 'audio';
  if (SUPPORTED_MIME_TYPES.document.includes(mime) || mime === 'application/pdf') return 'document';
  
  return null;
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
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/wmv',
    '3gp': 'video/3gpp',
    'mp3': 'audio/mp3',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'opus': 'audio/ogg',
    // Novos formatos de documento
    'rtf': 'text/rtf',
    'js': 'text/javascript',
    'py': 'text/x-python',
    'xml': 'text/xml',
    'md': 'text/markdown',
  };
  
  return ext ? mimeMap[ext] || null : null;
}

/**
 * Faz upload de um arquivo para a Gemini File API
 * @returns O URI do arquivo no Gemini ou null em caso de erro
 */
export async function uploadToGemini(
  fileUrl: string,
  mimeType: string,
  apiKey: string,
  displayName?: string
): Promise<{ uri: string; name: string } | null> {
  try {
    console.log(`[GeminiFileAPI] 📤 Uploading: ${fileUrl.substring(0, 60)}...`);
    
    // 1. Download do arquivo
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error(`[GeminiFileAPI] ❌ Download failed: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    // Limite de 2GB por arquivo
    if (fileSize > 2 * 1024 * 1024 * 1024) {
      console.error(`[GeminiFileAPI] ❌ File too large: ${fileSize} bytes (max 2GB)`);
      return null;
    }
    
    console.log(`[GeminiFileAPI] 📦 Downloaded ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    
    // 2. Normaliza o MIME type
    const actualMimeType = mimeType.split(';')[0].trim() || 'application/octet-stream';
    
    // 3. Faz upload para a Gemini File API usando resumable upload
    const uploadMetadata = {
      file: {
        display_name: displayName || `media-${Date.now()}`
      }
    };
    
    // Inicia upload resumable
    const initResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
          'X-Goog-Upload-Header-Content-Type': actualMimeType,
        },
        body: JSON.stringify(uploadMetadata)
      }
    );
    
    if (!initResponse.ok) {
      const error = await initResponse.text();
      console.error(`[GeminiFileAPI] ❌ Upload init failed: ${initResponse.status}`, error);
      return null;
    }
    
    const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) {
      console.error(`[GeminiFileAPI] ❌ No upload URL returned`);
      return null;
    }
    
    // Faz o upload dos bytes
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': fileSize.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: arrayBuffer
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error(`[GeminiFileAPI] ❌ Upload failed: ${uploadResponse.status}`, error);
      return null;
    }
    
    const uploadResult = await uploadResponse.json();
    const fileUri = uploadResult.file?.uri;
    const fileName = uploadResult.file?.name;
    
    if (!fileUri || !fileName) {
      console.error(`[GeminiFileAPI] ❌ No file URI in response:`, uploadResult);
      return null;
    }
    
    console.log(`[GeminiFileAPI] ✅ Uploaded: ${fileName}`);
    return { uri: fileUri, name: fileName };
    
  } catch (error) {
    console.error(`[GeminiFileAPI] ❌ Upload error:`, error);
    return null;
  }
}

/**
 * Analisa um arquivo já uploadado no Gemini
 */
export async function analyzeWithGemini(
  fileUri: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    console.log(`[GeminiFileAPI] 🔍 Analyzing: ${fileUri.substring(0, 60)}...`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                file_data: {
                  mime_type: mimeType.split(';')[0].trim(),
                  file_uri: fileUri
                }
              },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048
          }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[GeminiFileAPI] ❌ Analysis failed: ${response.status}`, error);
      return null;
    }
    
    const result = await response.json();
    const analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (analysisText) {
      console.log(`[GeminiFileAPI] ✅ Analysis complete (${analysisText.length} chars)`);
      return analysisText;
    }
    
    return null;
  } catch (error) {
    console.error(`[GeminiFileAPI] ❌ Analysis error:`, error);
    return null;
  }
}

/**
 * Deleta um arquivo da Gemini File API
 */
export async function deleteFromGemini(
  fileName: string,
  apiKey: string
): Promise<boolean> {
  try {
    console.log(`[GeminiFileAPI] 🗑️ Deleting: ${fileName}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
      { method: 'DELETE' }
    );
    
    if (!response.ok) {
      // 404 = já deletado (pode ter expirado os 48h)
      if (response.status === 404) {
        console.log(`[GeminiFileAPI] ℹ️ File already deleted/expired`);
        return true;
      }
      console.error(`[GeminiFileAPI] ⚠️ Delete failed: ${response.status}`);
      return false;
    }
    
    console.log(`[GeminiFileAPI] ✅ File deleted`);
    return true;
  } catch (error) {
    console.error(`[GeminiFileAPI] ⚠️ Delete error:`, error);
    return false;
  }
}

/**
 * Função principal: analisa mídia usando Gemini File API com cache
 * 
 * Fluxo:
 * 1. Verifica cache
 * 2. Se não tem cache: upload → análise → salva cache → deleta arquivo
 * 3. Retorna resultado
 */
export async function analyzeMedia(
  mediaUrl: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  supabase?: any,
  companyId?: string,
  cacheKeyPrefix?: string
): Promise<{ analysis: string | null; fromCache: boolean; error?: string }> {
  const cacheEnabled = !!supabase && !!companyId;
  const cacheKey = cacheKeyPrefix ? `${cacheKeyPrefix}:${mediaUrl}` : mediaUrl;
  
  try {
    // 1. Verifica cache
    if (cacheEnabled) {
      const cached = await getCachedAnalysis(supabase, cacheKey, companyId);
      if (cached) {
        // Cache pode ter diferentes formatos dependendo de quem salvou
        const analysisText = typeof cached === 'string' 
          ? cached 
          : cached.analysis || cached.transcription || cached.description || null;
        
        if (analysisText) {
          console.log(`[GeminiFileAPI] ✅ Cache HIT`);
          return { analysis: analysisText, fromCache: true };
        }
      }
      console.log(`[GeminiFileAPI] 📡 Cache MISS - usando File API`);
    }
    
    // 2. Determina o tipo de mídia e o prompt apropriado
    const mediaType = inferMediaType(mimeType);
    if (!mediaType) {
      console.error(`[GeminiFileAPI] ❌ Unsupported MIME type: ${mimeType}`);
      return { analysis: null, fromCache: false, error: `Unsupported MIME type: ${mimeType}` };
    }
    
    // 3. Upload para Gemini
    const uploadResult = await uploadToGemini(mediaUrl, mimeType, apiKey);
    if (!uploadResult) {
      return { analysis: null, fromCache: false, error: 'Upload failed' };
    }
    
    const { uri: fileUri, name: fileName } = uploadResult;
    
    // 4. Análise
    let analysisPrompt = prompt;
    if (!prompt) {
      switch (mediaType) {
        case 'audio':
          analysisPrompt = 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação ou comentários.';
          break;
        case 'image':
          analysisPrompt = 'Descreva esta imagem de forma detalhada e objetiva. Inclua: objetos, pessoas, texto visível, cores e contexto geral.';
          break;
        case 'video':
          analysisPrompt = 'Descreva este vídeo de forma detalhada. Inclua: ações, objetos, pessoas, áudio/narração se houver, e contexto geral.';
          break;
        case 'document':
          analysisPrompt = 'Extraia as informações principais deste documento. Inclua: tipo do documento, dados importantes, números, datas e resumo do conteúdo.';
          break;
      }
    }
    
    const analysis = await analyzeWithGemini(fileUri, mimeType, analysisPrompt, apiKey);
    
    // 5. Deleta arquivo do Gemini (libera espaço)
    // Fire and forget - não bloqueia a resposta
    deleteFromGemini(fileName, apiKey).catch(err => {
      console.error(`[GeminiFileAPI] ⚠️ Delete error (non-blocking):`, err);
    });
    
    // 6. Salva no cache
    if (cacheEnabled && analysis) {
      // Salva com TTL de 3 dias (reduzido de 7 dias)
      saveCacheAnalysis(supabase, cacheKey, companyId, mediaType, analysis, 3)
        .catch(err => console.error(`[GeminiFileAPI] ⚠️ Cache save error:`, err));
    }
    
    return { analysis, fromCache: false };
    
  } catch (error) {
    console.error(`[GeminiFileAPI] ❌ Error:`, error);
    return { 
      analysis: null, 
      fromCache: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Transcreve áudio usando Gemini File API
 * Wrapper conveniente para áudio
 */
export async function transcribeAudioWithFileAPI(
  audioUrl: string,
  apiKey: string,
  supabase?: any,
  companyId?: string
): Promise<string | null> {
  const mimeType = inferMimeTypeFromFileName(audioUrl) || 'audio/ogg';
  const result = await analyzeMedia(
    audioUrl,
    mimeType,
    'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação ou comentários adicionais.',
    apiKey,
    supabase,
    companyId,
    'audio-transcription'
  );
  
  return result.analysis;
}

/**
 * Analisa imagem usando Gemini File API
 * Wrapper conveniente para imagens
 */
export async function analyzeImageWithFileAPI(
  imageUrl: string,
  apiKey: string,
  supabase?: any,
  companyId?: string,
  customPrompt?: string
): Promise<string | null> {
  const mimeType = inferMimeTypeFromFileName(imageUrl) || 'image/jpeg';
  const result = await analyzeMedia(
    imageUrl,
    mimeType,
    customPrompt || 'Descreva esta imagem de forma detalhada e objetiva para contexto de atendimento ao cliente.',
    apiKey,
    supabase,
    companyId,
    'image-analysis'
  );
  
  return result.analysis;
}

/**
 * Analisa vídeo usando Gemini File API
 * Wrapper conveniente para vídeos
 */
export async function analyzeVideoWithFileAPI(
  videoUrl: string,
  apiKey: string,
  supabase?: any,
  companyId?: string,
  customPrompt?: string
): Promise<string | null> {
  const mimeType = inferMimeTypeFromFileName(videoUrl) || 'video/mp4';
  const result = await analyzeMedia(
    videoUrl,
    mimeType,
    customPrompt || 'Descreva este vídeo de forma detalhada. Inclua ações, objetos, pessoas, áudio e contexto geral.',
    apiKey,
    supabase,
    companyId,
    'video-analysis'
  );
  
  return result.analysis;
}

/**
 * Analisa documento usando Gemini File API
 * Wrapper conveniente para documentos
 */
export async function analyzeDocumentWithFileAPI(
  documentUrl: string,
  apiKey: string,
  supabase?: any,
  companyId?: string,
  fileName?: string,
  customPrompt?: string
): Promise<string | null> {
  const mimeType = inferMimeTypeFromFileName(fileName || documentUrl) || 'application/pdf';
  const result = await analyzeMedia(
    documentUrl,
    mimeType,
    customPrompt || `Extraia as informações principais deste documento "${fileName || 'documento'}". Inclua: tipo, dados importantes, números, datas e resumo.`,
    apiKey,
    supabase,
    companyId,
    'document-analysis'
  );
  
  return result.analysis;
}
