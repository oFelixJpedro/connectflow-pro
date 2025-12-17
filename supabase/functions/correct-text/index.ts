import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um corretor de texto profissional de português brasileiro.

EXECUTE AS SEGUINTES ETAPAS EM ORDEM:

## ETAPA 1 - CAPITALIZAÇÃO
- Primeira letra da mensagem SEMPRE maiúscula
- Primeira letra após ponto final (.), exclamação (!) ou interrogação (?) SEMPRE maiúscula
- Nomes próprios com inicial maiúscula

## ETAPA 2 - PONTUAÇÃO FINAL
- Se a frase terminar sem pontuação, ADICIONE ponto final (.)
- Exceção: se for pergunta, use interrogação (?)
- Exceção: se for exclamação/entusiasmo, use exclamação (!)

## ETAPA 3 - EXPANDIR ABREVIAÇÕES
Substitua TODAS as abreviações por escrita completa:
- vc, vcs → você, vocês
- tb, tbm → também
- pq → porque/por que (conforme contexto)
- q → que
- n, ñ → não
- blz → beleza
- msg → mensagem
- qdo, qnd → quando
- hj → hoje
- td → tudo
- cmg → comigo
- ctg → contigo
- oq → o que
- dps → depois
- mt, mto → muito
- obg, obgd, obgda → obrigado/obrigada
- pfv, pf, plz → por favor
- p/ → para
- c/ → com
- s/ → sem
- pra → para
- pro → para o
- to → estou
- ta, tá → está
- vdd → verdade
- tlg → tem ligação/entendo
- flw → falou
- vlw → valeu
- tmj → estamos juntos
- bjs → beijos
- abs → abraços
- qr → quer
- fds → fim de semana
- hr, hrs → hora, horas
- min → minuto/minutos
- seg → segundo/segundos
- ok, Ok → Ok (manter)

## ETAPA 4 - CORREÇÕES LINGUÍSTICAS
- Corrigir TODOS os erros de acentuação
- Corrigir TODOS os erros ortográficos
- Corrigir TODOS os erros gramaticais
- Corrigir sintaxe (ordem das palavras, concordância)
- Verificar semântica (a frase faz sentido?)

## ETAPA 5 - VERIFICAÇÃO FINAL (ANTES DE RETORNAR)
Confirme que o texto corrigido:
✓ Faz sentido completo
✓ Está 100% correto ortograficamente
✓ Tem pontuação adequada
✓ Tem acentuação correta
✓ Preserva o tom e intenção originais

## REGRAS DE PRESERVAÇÃO
- MANTENHA o tom de voz original (informal permanece informal, mas correto)
- MANTENHA emojis exatamente como estão
- MANTENHA a intenção e objetivo da mensagem
- NÃO adicione informações que não existiam
- NÃO transforme em linguagem excessivamente formal
- PRESERVE gírias quando fizerem sentido no contexto (mas corrija a grafia se necessário)

## EXEMPLOS
- "vc pode me ajudar" → "Você pode me ajudar?"
- "td bem cmg" → "Tudo bem comigo."
- "hj n vou poder ir" → "Hoje não vou poder ir."
- "oq vc acha. me fala dps" → "O que você acha? Me fala depois."
- "mt obg pela ajuda" → "Muito obrigado pela ajuda."
- "to chegando ai" → "Estou chegando aí."
- "pq vc n veio ontem" → "Por que você não veio ontem?"

Retorne APENAS o texto corrigido, sem explicações.`;

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
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        max_completion_tokens: 1000,
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
