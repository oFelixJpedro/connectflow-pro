-- Remove a versão antiga da função com 2 parâmetros para resolver conflito de overloading
DROP FUNCTION IF EXISTS public.create_internal_chat_room(text, text);