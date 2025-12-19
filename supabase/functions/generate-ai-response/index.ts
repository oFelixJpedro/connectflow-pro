import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente especializado em analisar conversas e gerar respostas que IMITAM PERFEITAMENTE o estilo de comunicação do atendente.

## SUA MISSÃO
Analisar a conversa COMPLETA e gerar uma resposta que:
1. Pareça ter sido escrita pelo próprio atendente (não por uma IA)
2. Use exatamente o mesmo tom, vocabulário e estilo observado
3. Seja contextualmente perfeita para a situação
4. Ajude o atendente quando ele não souber o que responder

## ANÁLISE OBRIGATÓRIA (faça antes de responder)

### Passo 1: Identificar o padrão do ATENDENTE
Analise TODAS as mensagens marcadas como [ATENDENTE] e identifique:
- Nível de formalidade (formal/semiformal/informal/muito informal)
- Uso de emojis (usa muito/pouco/nunca? quais tipos?)
- Cumprimentos típicos (como ele saúda? "Oi", "Olá", "E aí"?, "Bom dia"?)
- Despedidas típicas (como ele finaliza?)
- Comprimento das respostas (curtas e diretas ou elaboradas?)
- Expressões recorrentes (gírias, bordões, frases características)
- Pontuação (usa muitas exclamações? reticências? ponto final?)
- Capitalização (tudo minúsculo? normal? CAPS para ênfase?)
- Uso de abreviações (vc, pq, tb, etc. ou por extenso?)

### Passo 2: Entender o CONTEXTO da conversa
- Qual é o assunto principal sendo discutido?
- Qual é a última pergunta/solicitação do cliente?
- Há algum problema a ser resolvido?
- Qual é o estado emocional do cliente? (satisfeito, irritado, confuso, ansioso?)
- O que o cliente espera como resposta?
- Há informações anteriores na conversa que podem ajudar?

### Passo 3: Gerar resposta IMITANDO o atendente
Use EXATAMENTE o mesmo padrão identificado no Passo 1.

## REGRAS CRÍTICAS

1. IMITE o atendente - se ele usa "vc", use "vc"; se ele usa "você", use "você"
2. COPIE o nível de emoji - se ele usa 😊 frequentemente, use também; se não usa, não use
3. MANTENHA o comprimento típico - se ele é conciso, seja conciso; se é detalhado, seja detalhado
4. PRESERVE o vocabulário - use as mesmas palavras e expressões dele
5. RESPONDA apenas ao que foi perguntado - seja relevante e direto
6. NÃO invente informações que não existem na conversa
7. NÃO use formatação markdown (sem asteriscos, bullets, hashtags, etc.)
8. NÃO inclua saudações se a conversa já está em andamento (meio da conversa)
9. SE não houver mensagens suficientes do atendente, use tom profissional neutro mas amigável
10. SE o cliente está frustrado ou irritado, seja empático e compreensivo
11. Use o nome do cliente quando apropriado para personalização
12. BASEIE sua resposta 100% no contexto da conversa
13. SE houver imagens enviadas pelo cliente, ANALISE o conteúdo visual e responda considerando o que está na imagem

## FORMATO DA CONVERSA
- [CLIENTE]: mensagens enviadas pelo cliente
- [ATENDENTE]: mensagens enviadas pelo atendente (ESTUDE ESTE PADRÃO!)

## EXEMPLOS DE IMITAÇÃO

### Exemplo 1 - Atendente informal
Se o atendente escreveu:
"[ATENDENTE]: oi! td bem? em q posso te ajudar hj? 😊"
"[ATENDENTE]: achei aqui! ta previsto pra amanhã"

Sua resposta deve seguir o mesmo padrão:
"entendi! vou verificar isso pra vc agora, só um momento 😊"

E NÃO:
"Entendi. Vou verificar isso para você agora. Aguarde um momento."

### Exemplo 2 - Atendente formal
Se o atendente escreveu:
"[ATENDENTE]: Bom dia! Como posso ajudá-lo hoje?"
"[ATENDENTE]: Perfeito, vou verificar essa informação para você."

Sua resposta deve seguir o mesmo padrão:
"Compreendo sua preocupação. Vou analisar a situação e retornar com uma solução."

### Exemplo 3 - Atendente direto sem emoji
Se o atendente escreveu:
"[ATENDENTE]: oi"
"[ATENDENTE]: ok, vou ver"

Sua resposta deve ser igualmente direta:
"entendi, vou resolver"

## INFORMAÇÕES ADICIONAIS DISPONÍVEIS
- Nome do atendente: pode ser usado internamente para contexto
- Departamento: indica a área de atuação (vendas, suporte, etc.)
- Tags da conversa: indicam o assunto/categoria

Retorne APENAS a resposta final, sem análises, explicações ou comentários.`;

interface MessageInput {
  content: string | null;
  direction: 'inbound' | 'outbound';
  messageType: string;
  mediaUrl?: string;
  metadata?: {
    transcription?: string;
    fileName?: string;
    file_name?: string;
  };
}

interface RequestBody {
  messages: MessageInput[];
  contactName: string;
  agentName?: string;
  department?: string;
  tags?: string[];
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to transcribe audio using Gemini
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcrevendo áudio com Gemini:', audioUrl.substring(0, 80) + '...');
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.log('❌ Falha ao baixar áudio:', audioResponse.status);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Determine mime type
    let mimeType = 'audio/ogg';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) mimeType = 'audio/mp3';
    else if (contentType.includes('wav')) mimeType = 'audio/wav';
    else if (contentType.includes('webm')) mimeType = 'audio/webm';
    else if (contentType.includes('m4a')) mimeType = 'audio/mp4';
    else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações ou comentários adicionais.' },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Audio
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
          }
        }),
      }
    );
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.log('❌ Erro Gemini transcrição:', geminiResponse.status, errorText);
      return null;
    }
    
    const result = await geminiResponse.json();
    const transcription = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (transcription) {
      console.log('✅ Áudio transcrito:', transcription.substring(0, 50) + '...');
      return transcription;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error);
    return null;
  }
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('🖼️ Baixando imagem:', imageUrl.substring(0, 80) + '...');
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log('❌ Falha ao baixar imagem:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Normalize mime type
    let mimeType = 'image/jpeg';
    if (contentType.includes('png')) mimeType = 'image/png';
    else if (contentType.includes('gif')) mimeType = 'image/gif';
    else if (contentType.includes('webp')) mimeType = 'image/webp';
    
    console.log('✅ Imagem convertida para base64, tipo:', mimeType);
    return { data: base64, mimeType };
  } catch (error) {
    console.error('❌ Erro ao baixar imagem:', error);
    return null;
  }
}

// Supported video MIME types by Gemini
const SUPPORTED_VIDEO_MIMES = [
  'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv',
  'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska'
];

// Supported document MIME types by Gemini
const SUPPORTED_DOCUMENT_MIMES = [
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

// Helper function to fetch video as base64 (max 20MB for inline_data)
async function fetchVideoAsBase64(videoUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('🎬 Baixando vídeo:', videoUrl.substring(0, 80) + '...');
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.log('❌ Falha ao baixar vídeo:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    
    // Check size limit (20MB for inline_data)
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log('⚠️ Vídeo muito grande para análise:', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
      return null;
    }
    
    const base64 = arrayBufferToBase64(buffer);
    const contentType = response.headers.get('content-type') || 'video/mp4';
    
    // Normalize mime type
    let mimeType = 'video/mp4';
    if (contentType.includes('webm')) mimeType = 'video/webm';
    else if (contentType.includes('quicktime') || contentType.includes('mov')) mimeType = 'video/quicktime';
    else if (contentType.includes('avi') || contentType.includes('x-msvideo')) mimeType = 'video/x-msvideo';
    else if (contentType.includes('3gpp')) mimeType = 'video/3gpp';
    else if (contentType.includes('mpeg')) mimeType = 'video/mpeg';
    else if (contentType.includes('matroska') || contentType.includes('mkv')) mimeType = 'video/x-matroska';
    
    console.log('✅ Vídeo convertido para base64, tipo:', mimeType, 'tamanho:', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
    return { data: base64, mimeType };
  } catch (error) {
    console.error('❌ Erro ao baixar vídeo:', error);
    return null;
  }
}

// Helper function to fetch document as base64 (max 20MB for inline_data)
async function fetchDocumentAsBase64(docUrl: string, fileName?: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('📄 Baixando documento:', docUrl.substring(0, 80) + '...');
    
    const response = await fetch(docUrl);
    if (!response.ok) {
      console.log('❌ Falha ao baixar documento:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    
    // Check size limit (20MB for inline_data)
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log('⚠️ Documento muito grande para análise:', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
      return null;
    }
    
    const base64 = arrayBufferToBase64(buffer);
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Try to infer mime type from filename if content-type is generic
    if (contentType === 'application/octet-stream' && fileName) {
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
        'js': 'application/x-javascript'
      };
      if (ext && mimeMap[ext]) {
        contentType = mimeMap[ext];
      }
    }
    
    // Verify it's a supported mime type
    const isSupported = SUPPORTED_DOCUMENT_MIMES.some(m => contentType.includes(m.split('/')[1]) || contentType === m);
    if (!isSupported) {
      console.log('⚠️ Tipo de documento não suportado:', contentType);
      return null;
    }
    
    console.log('✅ Documento convertido para base64, tipo:', contentType, 'tamanho:', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
    return { data: base64, mimeType: contentType };
  } catch (error) {
    console.error('❌ Erro ao baixar documento:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contactName, agentName, department, tags } = await req.json() as RequestBody;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma mensagem fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('❌ GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to last 100 messages
    const recentMessages = messages.slice(-100);
    
    // Collect media for multimodal analysis
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    const documentData: { url: string; fileName: string }[] = [];
    
    // Process messages and collect media
    const processedMessages: string[] = [];
    
    for (const msg of recentMessages) {
      const prefix = msg.direction === 'inbound' ? '[CLIENTE]' : '[ATENDENTE]';
      let content = msg.content;
      const metadata = msg.metadata;
      
      if (msg.messageType === 'audio') {
        // Handle audio - use transcription if available, otherwise transcribe
        if (metadata?.transcription) {
          content = `[Áudio transcrito]: ${metadata.transcription}`;
        } else if (msg.mediaUrl) {
          const transcription = await transcribeAudio(msg.mediaUrl, geminiApiKey);
          content = transcription 
            ? `[Áudio transcrito]: ${transcription}`
            : '[Áudio sem transcrição disponível]';
        } else {
          content = '[Mensagem de áudio]';
        }
      } else if (msg.messageType === 'image') {
        // Collect image URL for multimodal analysis
        if (msg.mediaUrl && msg.direction === 'inbound') {
          imageUrls.push(msg.mediaUrl);
          content = msg.content 
            ? `[Imagem com legenda: ${msg.content}] (imagem será analisada)`
            : '[Cliente enviou uma imagem] (imagem será analisada)';
        } else {
          content = msg.content 
            ? `[Imagem com legenda]: ${msg.content}`
            : '[Cliente enviou uma imagem]';
        }
      } else if (msg.messageType === 'video') {
        // Collect video URL for multimodal analysis
        if (msg.mediaUrl && msg.direction === 'inbound') {
          videoUrls.push(msg.mediaUrl);
          content = msg.content 
            ? `[Vídeo com legenda: ${msg.content}] (vídeo será analisado)`
            : '[Cliente enviou um vídeo] (vídeo será analisado)';
        } else {
          content = msg.content 
            ? `[Vídeo com legenda]: ${msg.content}`
            : '[Cliente enviou um vídeo]';
        }
      } else if (msg.messageType === 'document') {
        const fileName = metadata?.fileName || metadata?.file_name || 'documento';
        // Collect document data for multimodal analysis
        if (msg.mediaUrl && msg.direction === 'inbound') {
          documentData.push({ url: msg.mediaUrl, fileName });
          content = msg.content 
            ? `[Documento "${fileName}": ${msg.content}] (documento será analisado)`
            : `[Cliente enviou documento: ${fileName}] (documento será analisado)`;
        } else {
          content = msg.content 
            ? `[Documento "${fileName}"]: ${msg.content}`
            : `[Cliente enviou documento: ${fileName}]`;
        }
      } else if (msg.messageType === 'sticker') {
        content = '[Cliente enviou um sticker]';
      } else if (!content || content.trim() === '') {
        content = '[Mensagem sem texto]';
      }
      
      processedMessages.push(`${prefix}: ${content}`);
    }
    
    const formattedMessages = processedMessages.join('\n');

    // Build enriched system prompt
    let enrichedSystemPrompt = SYSTEM_PROMPT;
    const contextParts: string[] = [];
    
    if (contactName && contactName !== 'Cliente') {
      contextParts.push(`Nome do cliente: ${contactName}`);
    }
    if (agentName) {
      contextParts.push(`Nome do atendente: ${agentName}`);
    }
    if (department) {
      contextParts.push(`Departamento: ${department}`);
    }
    if (tags && tags.length > 0) {
      contextParts.push(`Tags da conversa: ${tags.join(', ')}`);
    }
    
    if (contextParts.length > 0) {
      enrichedSystemPrompt += `\n\n## CONTEXTO DESTA CONVERSA\n${contextParts.join('\n')}`;
    }

    console.log('🤖 Gerando resposta com Gemini para', contactName);
    console.log('📊 Total de mensagens:', recentMessages.length);
    console.log('🖼️ Imagens para analisar:', imageUrls.length);
    console.log('🎬 Vídeos para analisar:', videoUrls.length);
    console.log('📄 Documentos para analisar:', documentData.length);
    console.log('👤 Atendente:', agentName || 'N/A');

    // Build the prompt
    const fullPrompt = `${enrichedSystemPrompt}\n\nAnalise esta conversa e gere a próxima resposta imitando o estilo do atendente:\n\n${formattedMessages}`;

    // Build parts array for Gemini
    const parts: any[] = [{ text: fullPrompt }];

    // If there are images, fetch and add them as inline_data
    if (imageUrls.length > 0) {
      console.log('🖼️ Processando imagens para análise multimodal...');
      
      // Limit to last 5 images to avoid token limits
      const imagesToAnalyze = imageUrls.slice(-5);
      
      for (const imageUrl of imagesToAnalyze) {
        const imageData = await fetchImageAsBase64(imageUrl);
        if (imageData) {
          parts.push({
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.data
            }
          });
        }
      }
      
      console.log('✅ Imagens processadas:', imagesToAnalyze.length);
    }

    // If there are videos, fetch and add them as inline_data
    if (videoUrls.length > 0) {
      console.log('🎬 Processando vídeos para análise multimodal...');
      
      // Limit to last 3 videos (they consume more tokens)
      const videosToAnalyze = videoUrls.slice(-3);
      
      for (const videoUrl of videosToAnalyze) {
        const videoData = await fetchVideoAsBase64(videoUrl);
        if (videoData) {
          parts.push({
            inline_data: {
              mime_type: videoData.mimeType,
              data: videoData.data
            }
          });
        }
      }
      
      console.log('✅ Vídeos processados:', videosToAnalyze.length);
    }

    // If there are documents, fetch and add them as inline_data
    if (documentData.length > 0) {
      console.log('📄 Processando documentos para análise multimodal...');
      
      // Limit to last 5 documents
      const docsToAnalyze = documentData.slice(-5);
      
      for (const doc of docsToAnalyze) {
        const docData = await fetchDocumentAsBase64(doc.url, doc.fileName);
        if (docData) {
          parts.push({
            inline_data: {
              mime_type: docData.mimeType,
              data: docData.data
            }
          });
        }
      }
      
      console.log('✅ Documentos processados:', docsToAnalyze.length);
    }

    console.log('📦 Total de partes para Gemini:', parts.length);

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4000
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar resposta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('📦 Gemini response received');
    
    const generatedResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedResponse) {
      console.error('❌ No content in response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'Nenhuma resposta gerada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada com sucesso');
    console.log('📝 Resposta:', generatedResponse.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ response: generatedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in generate-ai-response function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
