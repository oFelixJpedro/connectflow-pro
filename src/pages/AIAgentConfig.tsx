import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  FileText, 
  List, 
  HelpCircle,
  Settings,
  Info,
  Users,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentMedia } from '@/hooks/useAgentMedia';
import { AgentRulesTab } from '@/components/ai-agents/config/AgentRulesTab';
import { AgentScriptTab } from '@/components/ai-agents/config/AgentScriptTab';
import { AgentFAQTab } from '@/components/ai-agents/config/AgentFAQTab';
import { AgentSubAgentsTab } from '@/components/ai-agents/config/AgentSubAgentsTab';
import { AgentSpecialtyTab } from '@/components/ai-agents/config/AgentSpecialtyTab';
import { AgentSidebar } from '@/components/ai-agents/config/AgentSidebar';
import { AI_AGENT_CHAR_LIMITS } from '@/types/ai-agents';
import type { AIAgent, UpdateAIAgentData } from '@/types/ai-agents';
import { toast } from 'sonner';

export default function AIAgentConfig() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { agents, updateAgent, loadAgents, setAgentStatus, getParentAgent } = useAIAgents();
  const { medias, loadMedias } = useAgentMedia(agentId || null);
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [activeTab, setActiveTab] = useState('rules');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form state
  const [rulesContent, setRulesContent] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [faqContent, setFaqContent] = useState('');
  const [companyInfo, setCompanyInfo] = useState<Record<string, string>>({});
  const [contractLink, setContractLink] = useState('');
  
  // Specialty metadata state
  const [specialtyKeywords, setSpecialtyKeywords] = useState<string[]>([]);
  const [qualificationSummary, setQualificationSummary] = useState('');
  const [disqualificationSigns, setDisqualificationSigns] = useState('');

  // Verificar permissão (owner/admin)
  const canManage = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Carregar agente e mídias
  useEffect(() => {
    if (agentId && agents.length > 0) {
      const found = agents.find(a => a.id === agentId);
      if (found) {
        setAgent(found);
        setRulesContent(found.rules_content || '');
        setScriptContent(found.script_content || '');
        setFaqContent(found.faq_content || '');
        setCompanyInfo(found.company_info || {});
        setContractLink(found.contract_link || '');
        // Load specialty metadata
        setSpecialtyKeywords(found.specialty_keywords || []);
        setQualificationSummary(found.qualification_summary || '');
        setDisqualificationSigns(found.disqualification_signs || '');
      }
    }
  }, [agentId, agents]);

  // Carregar mídias quando o agente muda
  useEffect(() => {
    if (agentId) {
      loadMedias();
    }
  }, [agentId, loadMedias]);

  // Calcular total de caracteres
  const totalChars = rulesContent.length + scriptContent.length + faqContent.length;
  const charPercentage = Math.min(100, (totalChars / AI_AGENT_CHAR_LIMITS.total) * 100);

  const handleSave = async () => {
    if (!agent || !canManage) return;

    setIsSaving(true);
    try {
      const success = await updateAgent(agent.id, {
        rules_content: rulesContent,
        script_content: scriptContent,
        faq_content: faqContent,
        company_info: companyInfo,
        contract_link: contractLink,
        specialty_keywords: specialtyKeywords,
        qualification_summary: qualificationSummary,
        disqualification_signs: disqualificationSigns,
      });

      if (success) {
        setHasChanges(false);
        toast.success('Agente salvo com sucesso!');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!agent || !canManage) return;
    await setAgentStatus(agent.id, newStatus as 'active' | 'paused' | 'inactive');
    loadAgents();
  };

  const handleContentChange = (type: 'rules' | 'script' | 'faq', content: string) => {
    setHasChanges(true);
    switch (type) {
      case 'rules':
        setRulesContent(content);
        break;
      case 'script':
        setScriptContent(content);
        break;
      case 'faq':
        setFaqContent(content);
        break;
    }
  };

  const handleCompanyInfoChange = (info: Record<string, string>) => {
    setHasChanges(true);
    setCompanyInfo(info);
  };

  const handleContractLinkChange = (link: string) => {
    setHasChanges(true);
    setContractLink(link);
  };

  const handleSpecialtyKeywordsChange = (keywords: string[]) => {
    setHasChanges(true);
    setSpecialtyKeywords(keywords);
  };

  const handleQualificationChange = (summary: string) => {
    setHasChanges(true);
    setQualificationSummary(summary);
  };

  const handleDisqualificationChange = (signs: string) => {
    setHasChanges(true);
    setDisqualificationSigns(signs);
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Info className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center">
          Apenas proprietários e administradores podem configurar Agentes de IA.
        </p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando agente...</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Ativo</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pausado</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  // Obter agente pai se for sub-agente
  const parentAgent = getParentAgent(agent.id);

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              // Se for sub-agente, voltar para o pai; senão, voltar para listagem
              if (parentAgent) {
                navigate(`/ai-agents/${parentAgent.id}`);
              } else {
                navigate('/ai-agents');
              }
            }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              {parentAgent ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                    <span 
                      className="hover:text-foreground cursor-pointer"
                      onClick={() => navigate(`/ai-agents/${parentAgent.id}`)}
                    >
                      {parentAgent.name}
                    </span>
                    <span>/</span>
                    <span className="text-foreground">Sub-agente</span>
                  </div>
                  <h1 className="font-semibold">{agent.name}</h1>
                </>
              ) : (
                <>
                  <h1 className="font-semibold">{agent.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    {agent.agent_type === 'multi' ? 'Agente Multiagente' : 'Configuração do agente'}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={agent.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-6">
            <div className="-mx-6 px-6 overflow-x-auto">
              <TabsList className="h-12 w-max min-w-full bg-transparent p-0 inline-flex gap-1">
                <TabsTrigger 
                  value="rules" 
                  className="flex-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 justify-center px-4"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Diretrizes do Agente
                </TabsTrigger>
                <TabsTrigger 
                  value="script"
                  className="flex-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 justify-center px-4"
                >
                  <List className="w-4 h-4 mr-2" />
                  Fluxo de Atendimento
                </TabsTrigger>
                <TabsTrigger 
                  value="faq"
                  className="flex-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 justify-center px-4"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Perguntas Frequentes
                </TabsTrigger>
                {/* Aba Especialidade - para configurar redirecionamento inteligente entre agentes */}
                <TabsTrigger 
                  value="specialty"
                  className="flex-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 justify-center px-4"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Especialidade
                </TabsTrigger>
                {/* Aba Sub-agentes - apenas para agentes do tipo multi */}
                {agent.agent_type === 'multi' && (
                  <TabsTrigger 
                    value="subagents"
                    className="flex-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 justify-center px-4"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Sub-agentes
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                <TabsContent value="rules" className="m-0">
                  <AgentRulesTab
                    content={rulesContent}
                    onChange={(content) => handleContentChange('rules', content)}
                    medias={medias}
                  />
                </TabsContent>
                <TabsContent value="script" className="m-0">
                  <AgentScriptTab
                    content={scriptContent}
                    onChange={(content) => handleContentChange('script', content)}
                    agentId={agent.id}
                    medias={medias}
                  />
                </TabsContent>
                <TabsContent value="faq" className="m-0">
                  <AgentFAQTab
                    content={faqContent}
                    onChange={(content) => handleContentChange('faq', content)}
                    companyInfo={companyInfo}
                    onCompanyInfoChange={handleCompanyInfoChange}
                    contractLink={contractLink}
                    onContractLinkChange={handleContractLinkChange}
                  />
                </TabsContent>
                <TabsContent value="specialty" className="m-0">
                  <AgentSpecialtyTab
                    specialtyKeywords={specialtyKeywords}
                    qualificationSummary={qualificationSummary}
                    disqualificationSigns={disqualificationSigns}
                    onKeywordsChange={handleSpecialtyKeywordsChange}
                    onQualificationChange={handleQualificationChange}
                    onDisqualificationChange={handleDisqualificationChange}
                  />
                </TabsContent>
                {agent.agent_type === 'multi' && (
                  <TabsContent value="subagents" className="m-0">
                    <AgentSubAgentsTab
                      agent={agent}
                      onUpdate={loadAgents}
                    />
                  </TabsContent>
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </div>

      {/* Sidebar */}
      <AgentSidebar
        agent={agent}
        totalChars={totalChars}
        charLimit={AI_AGENT_CHAR_LIMITS.total}
        onAgentUpdate={loadAgents}
      />
    </div>
  );
}
