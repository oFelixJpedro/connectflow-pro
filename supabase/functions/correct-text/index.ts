import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um corretor ortográfico e gramatical de português brasileiro.
Sua ÚNICA função é corrigir erros de:
- Acentuação
- Pontuação  
- Gramática
- Sintaxe
- Semântica

REGRAS IMPORTANTES:
1. NÃO altere o tom da mensagem (informal permanece informal)
2. NÃO transforme em português formal se estava informal
3. NÃO adicione ou remova palavras além do necessário para correção
4. NÃO mude gírias ou expressões coloquiais
5. Apenas corrija os ERROS, mantendo a essência original
6. Se o texto já estiver correto, retorne exatamente o mesmo texto

Retorne APENAS o texto corrigido, sem explicações ou comentários adicionais.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texto é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de API inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Corrigindo texto:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for more deterministic output
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API OpenAI:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar correção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content?.trim();

    if (!correctedText) {
      console.error('❌ Resposta vazia da API');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there were changes
    const hasChanges = correctedText !== text;

    console.log('✅ Correção concluída. Mudanças:', hasChanges);
    if (hasChanges) {
      console.log('   Original:', text.substring(0, 50));
      console.log('   Corrigido:', correctedText.substring(0, 50));
    }

    return new Response(
      JSON.stringify({ 
        correctedText,
        hasChanges,
        originalText: text
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('❌ Erro no correct-text:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
