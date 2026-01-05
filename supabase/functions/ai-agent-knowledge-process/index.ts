import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Text extraction helpers
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Simple PDF text extraction - extract text between streams
  // For production, consider using a dedicated PDF library
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  // Try to extract readable text from PDF
  const textMatches = text.match(/\(([^)]+)\)/g);
  if (textMatches) {
    const extractedText = textMatches
      .map(m => m.slice(1, -1))
      .filter(t => t.length > 2 && /[a-zA-ZÀ-ÿ]/.test(t))
      .join(' ');
    
    if (extractedText.length > 100) {
      return extractedText;
    }
  }
  
  // If simple extraction fails, use Gemini to extract text
  return '';
}

async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  // DOCX is a ZIP file with XML content
  // For simplicity, we'll extract readable text patterns
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  // Extract text from XML tags
  const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (textMatches) {
    return textMatches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ');
  }
  
  return '';
}

async function extractTextFromPlainFile(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder('utf-8').decode(arrayBuffer);
}

// Use Gemini to extract text from document if simple extraction fails
async function extractTextWithGemini(
  fileUrl: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  console.log('📄 Using Gemini to extract text from document...');
  
  // Download file
  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            },
            {
              text: 'Extraia TODO o texto deste documento. Retorne apenas o texto extraído, sem formatação adicional ou comentários.'
            }
          ]
        }]
      })
    }
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const result = await geminiResponse.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Split text into chunks for embedding
function splitIntoChunks(text: string, maxChunkSize: number = 500): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    if ((currentChunk + ' ' + trimmedSentence).length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedSentence;
    } else {
      currentChunk = currentChunk ? `${currentChunk}. ${trimmedSentence}` : trimmedSentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate embeddings using Gemini
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${errorText}`);
  }

  const result = await response.json();
  return result.embedding?.values || [];
}

serve(async (req) => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           📚 AI AGENT KNOWLEDGE PROCESS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { documentId, agentId, companyId, storagePath, fileName, fileType } = await req.json();

    console.log('📥 Processing document:', { documentId, fileName, fileType });

    if (!documentId || !agentId || !storagePath) {
      throw new Error('Missing required parameters');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('ai-agent-knowledge')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log('📥 Downloaded file, size:', fileData.size);

    // Extract text based on file type
    let extractedText = '';
    const arrayBuffer = await fileData.arrayBuffer();

    if (fileType.includes('pdf')) {
      extractedText = await extractTextFromPDF(arrayBuffer);
    } else if (fileType.includes('word') || fileType.includes('docx')) {
      extractedText = await extractTextFromDocx(arrayBuffer);
    } else if (fileType.includes('text') || fileType.includes('plain') || fileType.includes('markdown')) {
      extractedText = await extractTextFromPlainFile(arrayBuffer);
    }

    // If extraction failed, use Gemini
    if (!extractedText || extractedText.length < 50) {
      console.log('⚠️ Simple extraction failed, using Gemini...');
      
      // Get signed URL for the file
      const { data: urlData } = await supabase.storage
        .from('ai-agent-knowledge')
        .createSignedUrl(storagePath, 3600);

      if (urlData?.signedUrl) {
        extractedText = await extractTextWithGemini(urlData.signedUrl, fileType, geminiApiKey);
      }
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Could not extract text from document');
    }

    console.log('✅ Extracted text length:', extractedText.length);

    // Split into chunks
    const chunks = splitIntoChunks(extractedText, 500);
    console.log('📦 Created', chunks.length, 'chunks');

    // Generate embeddings and save chunks
    const chunkRecords = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);
      
      try {
        const embedding = await generateEmbedding(chunk, geminiApiKey);
        
        chunkRecords.push({
          document_id: documentId,
          agent_id: agentId,
          chunk_index: i,
          content: chunk,
          embedding: JSON.stringify(embedding),
        });
      } catch (embeddingError) {
        console.error(`❌ Error generating embedding for chunk ${i}:`, embeddingError);
        // Continue with other chunks
      }
      
      // Small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Insert all chunks
    if (chunkRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_agent_knowledge_chunks')
        .insert(chunkRecords);

      if (insertError) {
        console.error('❌ Error inserting chunks:', insertError);
        throw insertError;
      }

      console.log('✅ Inserted', chunkRecords.length, 'chunks with embeddings');
    }

    // Update document status to ready
    const { error: updateError } = await supabase
      .from('ai_agent_knowledge_documents')
      .update({
        status: 'ready',
        extracted_text: extractedText.substring(0, 50000), // Limit stored text
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Document processing complete!');

    return new Response(
      JSON.stringify({
        success: true,
        chunksCreated: chunkRecords.length,
        textLength: extractedText.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing document:', error);

    // Try to update document status to error
    try {
      const { documentId } = await req.clone().json();
      if (documentId) {
        await supabase
          .from('ai_agent_knowledge_documents')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
