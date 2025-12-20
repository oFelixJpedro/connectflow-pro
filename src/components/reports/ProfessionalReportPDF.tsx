import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CommercialReport } from '@/hooks/useReportsData';

const colors = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1f2937',
  gray: '#6b7280',
  lightGray: '#e5e7eb',
  background: '#f9fafb',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.dark,
    backgroundColor: colors.white,
  },
  coverPage: {
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    backgroundColor: colors.white,
  },
  coverBadge: {
    backgroundColor: colors.primary,
    color: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    fontSize: 10,
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.dark,
    textAlign: 'center',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 50,
  },
  coverPeriod: {
    fontSize: 18,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  coverDate: {
    fontSize: 11,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 60,
  },
  coverClassification: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerDate: {
    fontSize: 9,
    color: colors.gray,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gray,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    width: '23%',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 8,
    color: colors.gray,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: colors.dark,
    marginBottom: 12,
    textAlign: 'justify',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 10,
  },
  listBullet: {
    width: 15,
    fontSize: 10,
    color: colors.primary,
  },
  listNumber: {
    width: 18,
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  listText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.dark,
  },
  criteriaRow: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  criteriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  criteriaLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.dark,
  },
  criteriaValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
  },
  criteriaAnalysis: {
    fontSize: 9,
    color: colors.gray,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  criteriaImpact: {
    fontSize: 9,
    color: colors.dark,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  criteriaRecommendation: {
    fontSize: 9,
    color: colors.success,
    lineHeight: 1.4,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 15,
  },
  column: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 8,
  },
  cardSuccess: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  cardDanger: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  cardPrimary: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  footerText: {
    fontSize: 8,
    color: colors.gray,
  },
  pageNumber: {
    fontSize: 9,
    color: colors.gray,
  },
  agentCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  agentName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.dark,
  },
  agentScore: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
  },
  agentAnalysis: {
    fontSize: 9,
    color: colors.gray,
    marginBottom: 8,
    lineHeight: 1.4,
  },
  agentStrengths: {
    fontSize: 9,
    color: colors.success,
    marginBottom: 4,
  },
  agentDevelopment: {
    fontSize: 9,
    color: colors.warning,
    marginBottom: 4,
  },
  agentAction: {
    fontSize: 9,
    color: colors.primary,
    fontStyle: 'italic',
  },
  highlightBox: {
    backgroundColor: colors.primary,
    color: colors.white,
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
  },
  highlightText: {
    color: colors.white,
    fontSize: 11,
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  insightTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 4,
  },
  insightContext: {
    fontSize: 9,
    color: colors.gray,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  insightAction: {
    fontSize: 9,
    color: colors.primary,
  },
  conclusionBox: {
    backgroundColor: colors.background,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  finalMessage: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  finalMessageText: {
    color: colors.white,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

const criteriaLabels: Record<string, string> = {
  tempoResposta: 'Tempo de Resposta',
  comunicacao: 'Comunicação',
  objetividade: 'Objetividade',
  humanizacao: 'Humanização',
  fechamento: 'Fechamento',
  objecoes: 'Tratamento de Objeções',
  response_time: 'Tempo de Resposta',
  communication: 'Comunicação',
  objectivity: 'Objetividade',
  humanization: 'Humanização',
  closing: 'Fechamento',
  objection_handling: 'Tratamento de Objeções',
};

const classificationInfo: Record<string, { color: string; bg: string; description: string }> = {
  EXCEPCIONAL: { color: colors.success, bg: '#dcfce7', description: 'Performance excepcional da equipe' },
  BOM: { color: colors.primary, bg: '#e0e7ff', description: 'Bom desempenho geral da equipe' },
  REGULAR: { color: colors.warning, bg: '#fef3c7', description: 'Desempenho regular, há pontos de melhoria' },
  RUIM: { color: '#ea580c', bg: '#fed7aa', description: 'Desempenho abaixo do esperado' },
  CRÍTICO: { color: colors.danger, bg: '#fee2e2', description: 'Situação crítica, ação imediata necessária' },
  SEM_DADOS: { color: colors.gray, bg: colors.lightGray, description: 'Dados insuficientes para análise' },
};

interface Props {
  report: CommercialReport;
  companyName?: string;
}

export function ProfessionalReportPDF({ report, companyName = 'Sua Empresa' }: Props) {
  const classInfo = classificationInfo[report.classification || 'REGULAR'];
  const periodFormatted = `${format(new Date(report.week_start), "dd/MM/yyyy")} - ${format(new Date(report.week_end), "dd/MM/yyyy")}`;
  const generatedAt = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  const hasAIContent = report.report_content && Object.keys(report.report_content).length > 0;
  const content = report.report_content;

  // Fallback content generators
  const getExecutiveSummary = (): string => {
    if (hasAIContent && content?.executive_summary) {
      return content.executive_summary;
    }
    const qualityDesc = report.average_score >= 8 ? 'excepcional' : 
                        report.average_score >= 6 ? 'satisfatório' : 
                        report.average_score >= 4 ? 'regular' : 'abaixo do esperado';
    
    const conversionRate = report.total_conversations > 0 
      ? ((report.qualified_leads / report.total_conversations) * 100).toFixed(0) 
      : 0;

    return `Durante o período analisado de ${format(new Date(report.week_start), "dd 'de' MMMM", { locale: ptBR })} a ${format(new Date(report.week_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}, a equipe comercial realizou um total de ${report.total_conversations} atendimentos, obtendo uma nota média de ${report.average_score?.toFixed(1) || 0}/10, classificada como ${qualityDesc}. Dos leads atendidos, ${report.qualified_leads} foram identificados como potenciais clientes qualificados, representando uma taxa de qualificação de ${conversionRate}%. O período resultou em ${report.closed_deals || 0} vendas concluídas.`;
  };

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverBadge}>Relatório Semanal</Text>
        <Text style={styles.coverTitle}>ANÁLISE COMERCIAL</Text>
        <Text style={styles.coverSubtitle}>Gerente Comercial com Inteligência Artificial</Text>
        
        <Text style={styles.coverPeriod}>{periodFormatted}</Text>
        
        <View style={[styles.coverClassification, { backgroundColor: classInfo.bg }]}>
          <Text style={{ color: classInfo.color, fontWeight: 'bold', fontSize: 14 }}>
            Classificação: {report.classification === 'SEM_DADOS' ? 'Sem Dados' : report.classification}
          </Text>
        </View>

        <Text style={styles.coverDate}>
          Documento gerado em {generatedAt}
        </Text>
        
        {report.is_anticipated && (
          <View style={{ marginTop: 20, backgroundColor: '#fef3c7', padding: 10, borderRadius: 6 }}>
            <Text style={{ color: '#92400e', fontSize: 10, textAlign: 'center' }}>
              ⚡ Relatório Antecipado - Dados parciais da semana em curso
            </Text>
          </View>
        )}
      </Page>

      {/* Executive Summary Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sumário Executivo</Text>
          <Text style={styles.headerDate}>{periodFormatted}</Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{report.average_score?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.metricLabel}>Nota Média</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{report.total_conversations}</Text>
            <Text style={styles.metricLabel}>Conversas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.success }]}>{report.qualified_leads}</Text>
            <Text style={styles.metricLabel}>Leads Qualificados</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.warning }]}>{report.closed_deals || 0}</Text>
            <Text style={styles.metricLabel}>Vendas Fechadas</Text>
          </View>
        </View>

        {/* Executive Summary Text */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visão Geral do Período</Text>
          <Text style={styles.paragraph}>{getExecutiveSummary()}</Text>
        </View>

        {/* Period Overview */}
        {hasAIContent && content?.period_overview && (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Contexto do Período</Text>
            <Text style={styles.paragraph}>{content.period_overview}</Text>
          </View>
        )}

        {/* Classification Highlight */}
        <View style={[styles.highlightBox, { backgroundColor: classInfo.color }]}>
          <Text style={[styles.highlightText, { fontWeight: 'bold', marginBottom: 5 }]}>
            Classificação: {report.classification === 'SEM_DADOS' ? 'Sem Dados' : report.classification}
          </Text>
          <Text style={styles.highlightText}>{classInfo.description}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 2</Text>
        </View>
      </Page>

      {/* Criteria Analysis Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Análise de Critérios</Text>
          <Text style={styles.headerDate}>{periodFormatted}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            A análise abaixo apresenta o desempenho da equipe em cada critério de avaliação, 
            com análise detalhada do impacto e recomendações específicas de melhoria.
          </Text>
        </View>

        {/* Criteria with AI Analysis */}
        <View style={styles.section}>
          {Object.entries(report.criteria_scores || {}).map(([key, value]) => {
            const aiAnalysis = hasAIContent && content?.criteria_analysis?.[key];
            
            return (
              <View key={key} style={styles.criteriaRow}>
                <View style={styles.criteriaHeader}>
                  <Text style={styles.criteriaLabel}>{criteriaLabels[key] || key}</Text>
                  <Text style={styles.criteriaValue}>{value.toFixed(1)}/10</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${value * 10}%` }]} />
                </View>
                
                {aiAnalysis ? (
                  <>
                    <Text style={styles.criteriaAnalysis}>{aiAnalysis.analysis}</Text>
                    <Text style={styles.criteriaImpact}>Impacto: {aiAnalysis.impact}</Text>
                    <Text style={styles.criteriaRecommendation}>Recomendação: {aiAnalysis.recommendation}</Text>
                  </>
                ) : (
                  <Text style={styles.criteriaAnalysis}>
                    {value >= 7 
                      ? `O critério "${criteriaLabels[key] || key}" apresentou bom desempenho, contribuindo positivamente para os resultados.`
                      : `O critério "${criteriaLabels[key] || key}" apresenta oportunidade de melhoria para aumentar a efetividade comercial.`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 3</Text>
        </View>
      </Page>

      {/* Strengths & Weaknesses Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pontos Fortes e Áreas de Melhoria</Text>
          <Text style={styles.headerDate}>{periodFormatted}</Text>
        </View>

        <View style={styles.twoColumns}>
          {/* Strengths Column */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Pontos Fortes</Text>
            {hasAIContent && content?.strengths_detailed?.length > 0 ? (
              content.strengths_detailed.map((strength, i) => (
                <View key={i} style={[styles.card, styles.cardSuccess]}>
                  <Text style={styles.cardTitle}>{strength.title}</Text>
                  <Text style={styles.paragraph}>{strength.description}</Text>
                  <Text style={{ fontSize: 8, color: colors.success, fontStyle: 'italic' }}>
                    Evidência: {strength.evidence}
                  </Text>
                </View>
              ))
            ) : report.strengths?.length > 0 ? (
              report.strengths.map((strength, i) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.listBullet}>•</Text>
                  <Text style={styles.listText}>{strength}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.paragraph}>Nenhum ponto forte identificado neste período.</Text>
            )}
          </View>

          {/* Weaknesses Column */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Áreas de Melhoria</Text>
            {hasAIContent && content?.weaknesses_detailed?.length > 0 ? (
              content.weaknesses_detailed.map((weakness, i) => (
                <View key={i} style={[styles.card, styles.cardDanger]}>
                  <Text style={styles.cardTitle}>{weakness.title}</Text>
                  <Text style={styles.paragraph}>{weakness.description}</Text>
                  <Text style={{ fontSize: 8, color: colors.danger }}>
                    Impacto: {weakness.impact}
                  </Text>
                  <Text style={{ fontSize: 8, color: colors.primary, marginTop: 4 }}>
                    Ação: {weakness.recommendation}
                  </Text>
                </View>
              ))
            ) : report.weaknesses?.length > 0 ? (
              report.weaknesses.map((weakness, i) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.listBullet}>•</Text>
                  <Text style={styles.listText}>{weakness}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.paragraph}>Nenhuma área de melhoria identificada neste período.</Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 4</Text>
        </View>
      </Page>

      {/* Agents Performance Page */}
      {((hasAIContent && content?.agents_detailed?.length > 0) || report.agents_analysis?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Performance Individual dos Agentes</Text>
            <Text style={styles.headerDate}>{periodFormatted}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.paragraph}>
              Análise detalhada do desempenho de cada membro da equipe comercial, com pontos fortes identificados, 
              áreas de desenvolvimento e plano de ação personalizado.
            </Text>
          </View>

          {hasAIContent && content?.agents_detailed?.length > 0 ? (
            content.agents_detailed.map((agent, i) => (
              <View key={i} style={styles.agentCard}>
                <View style={styles.agentHeader}>
                  <Text style={styles.agentName}>{agent.agent_name}</Text>
                  <Text style={styles.agentScore}>{agent.score?.toFixed(1) || '0.0'}/10</Text>
                </View>
                <Text style={styles.agentAnalysis}>{agent.analysis}</Text>
                
                {agent.strengths?.length > 0 && (
                  <Text style={styles.agentStrengths}>
                    Pontos Fortes: {agent.strengths.join(', ')}
                  </Text>
                )}
                
                {agent.development_areas?.length > 0 && (
                  <Text style={styles.agentDevelopment}>
                    Áreas de Desenvolvimento: {agent.development_areas.join(', ')}
                  </Text>
                )}
                
                <Text style={styles.agentAction}>Plano de Ação: {agent.action_plan}</Text>
              </View>
            ))
          ) : (
            report.agents_analysis?.map((agent: any, i) => (
              <View key={i} style={styles.agentCard}>
                <View style={styles.agentHeader}>
                  <Text style={styles.agentName}>{agent.agent_name || agent.name || 'Agente'}</Text>
                  <Text style={styles.agentScore}>{(agent.average_score ?? agent.score)?.toFixed(1) || '0.0'}/10</Text>
                </View>
                <Text style={styles.agentAnalysis}>
                  Realizou {agent.total_conversations || 0} atendimentos no período analisado.
                </Text>
              </View>
            ))
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
            <Text style={styles.pageNumber}>Página 5</Text>
          </View>
        </Page>
      )}

      {/* Insights & Conclusion Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights e Conclusão</Text>
          <Text style={styles.headerDate}>{periodFormatted}</Text>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights Estratégicos</Text>
          {hasAIContent && content?.insights_detailed?.length > 0 ? (
            content.insights_detailed.map((item, i) => (
              <View key={i} style={styles.insightCard}>
                <Text style={styles.insightTitle}>{item.insight}</Text>
                <Text style={styles.insightContext}>{item.context}</Text>
                <Text style={styles.insightAction}>→ {item.action_suggested}</Text>
              </View>
            ))
          ) : report.insights?.length > 0 ? (
            report.insights.map((insight, i) => (
              <View key={i} style={styles.insightCard}>
                <Text style={styles.insightTitle}>{insight}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.paragraph}>Nenhum insight gerado para este período.</Text>
          )}
        </View>

        {/* Conclusion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conclusão</Text>
          <View style={styles.conclusionBox}>
            <Text style={styles.paragraph}>
              {hasAIContent && content?.conclusion 
                ? content.conclusion 
                : `O período analisado apresentou ${report.total_conversations} atendimentos com nota média de ${report.average_score?.toFixed(1) || 0}/10, classificada como ${report.classification}. ${report.closed_deals > 0 ? `Foram concluídas ${report.closed_deals} vendas.` : ''}`
              }
            </Text>
          </View>
        </View>

        {/* Next Steps */}
        {hasAIContent && content?.next_steps?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximos Passos</Text>
            {content.next_steps.map((step, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listNumber}>{i + 1}.</Text>
                <Text style={styles.listText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Final Message */}
        {hasAIContent && content?.final_message && (
          <View style={styles.finalMessage}>
            <Text style={styles.finalMessageText}>"{content.final_message}"</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 6</Text>
        </View>
      </Page>
    </Document>
  );
}
