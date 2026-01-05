import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface KnowledgeDocument {
  id: string;
  agent_id: string;
  company_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text: string | null;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useAgentKnowledge(agentId: string | null) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load documents for the agent
  const loadDocuments = useCallback(async () => {
    if (!agentId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_agent_knowledge_documents')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data as KnowledgeDocument[]) || []);
    } catch (error) {
      console.error('Error loading knowledge documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Upload a document
  const uploadDocument = useCallback(async (file: File): Promise<boolean> => {
    if (!agentId || !profile?.company_id) {
      toast.error('Agente ou empresa não identificados');
      return false;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${profile.company_id}/${agentId}/${timestamp}-${sanitizedName}`;

      // Upload to storage
      setUploadProgress(20);
      const { error: uploadError } = await supabase.storage
        .from('ai-agent-knowledge')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(50);

      // Create database record
      const { data: docData, error: insertError } = await supabase
        .from('ai_agent_knowledge_documents')
        .insert({
          agent_id: agentId,
          company_id: profile.company_id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          status: 'processing',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setUploadProgress(70);

      // Call edge function to process the document
      const { error: processError } = await supabase.functions.invoke('ai-agent-knowledge-process', {
        body: {
          documentId: docData.id,
          agentId,
          companyId: profile.company_id,
          storagePath,
          fileName: file.name,
          fileType: file.type,
        },
      });

      if (processError) {
        console.error('Error calling process function:', processError);
        // Don't fail the upload, the document is already saved
        // The processing can be retried later
      }

      setUploadProgress(100);
      
      // Reload documents to get updated list
      await loadDocuments();
      
      return true;
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
      return false;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [agentId, profile?.company_id, loadDocuments]);

  // Delete a document
  const deleteDocument = useCallback(async (documentId: string, storagePath: string): Promise<boolean> => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ai-agent-knowledge')
        .remove([storagePath]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue to delete the database record anyway
      }

      // Delete from database (chunks will be deleted via CASCADE)
      const { error: dbError } = await supabase
        .from('ai_agent_knowledge_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erro ao excluir documento');
      return false;
    }
  }, []);

  // Subscribe to document status changes
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`knowledge-docs-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_agent_knowledge_documents',
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const updatedDoc = payload.new as KnowledgeDocument;
          setDocuments(prev => 
            prev.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc)
          );
          
          if (updatedDoc.status === 'ready') {
            toast.success(`Documento "${updatedDoc.file_name}" processado!`);
          } else if (updatedDoc.status === 'error') {
            toast.error(`Erro ao processar "${updatedDoc.file_name}"`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    loadDocuments,
    uploadDocument,
    deleteDocument,
  };
}
