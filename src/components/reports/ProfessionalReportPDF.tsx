import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CommercialReport } from '@/hooks/useReportsData';

// Register fonts (using default for now, can add custom later)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', fontWeight: 'bold' },
  ],
});

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
  // Cover page
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
  // Header
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
  // Sections
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
  // Metrics grid
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
  // Paragraph
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: colors.dark,
    marginBottom: 12,
    textAlign: 'justify',
  },
  // Lists
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
  listText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.dark,
  },
  // Tables
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 9,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
  },
  tableRowAlt: {
    backgroundColor: colors.background,
  },
  tableCell: {
    fontSize: 9,
    color: colors.dark,
  },
  // Criteria bars
  criteriaRow: {
    marginBottom: 10,
  },
  criteriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  criteriaLabel: {
    fontSize: 10,
    color: colors.dark,
  },
  criteriaValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  // Two columns layout
  twoColumns: {
    flexDirection: 'row',
    gap: 15,
  },
  column: {
    flex: 1,
  },
  // Cards
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
  // Footer
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
  // Insights
  insightCard: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
  },
  insightText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.dark,
  },
  // Highlight box
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

// Helper functions
const getExecutiveSummary = (report: CommercialReport): string => {
  const qualityDesc = report.average_score >= 8 ? 'excepcional' : 
                      report.average_score >= 6 ? 'satisfatório' : 
                      report.average_score >= 4 ? 'regular' : 'abaixo do esperado';
  
  const conversionRate = report.total_conversations > 0 
    ? ((report.qualified_leads / report.total_conversations) * 100).toFixed(0) 
    : 0;

  return `Durante o período analisado de ${format(new Date(report.week_start), "dd 'de' MMMM", { locale: ptBR })} a ${format(new Date(report.week_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}, a equipe comercial realizou um total de ${report.total_conversations} atendimentos, obtendo uma nota média de ${report.average_score?.toFixed(1) || 0}/10, classificada como ${qualityDesc}. Dos leads atendidos, ${report.qualified_leads} foram identificados como potenciais clientes qualificados, representando uma taxa de qualificação de ${conversionRate}%. O período resultou em ${report.closed_deals || 0} vendas concluídas.`;
};

const getCriteriaAnalysis = (key: string, value: number): string => {
  const name = criteriaLabels[key] || key;
  if (value >= 8) return `O critério "${name}" apresentou desempenho excelente com nota ${value.toFixed(1)}, demonstrando domínio consistente nesta competência.`;
  if (value >= 6) return `O critério "${name}" obteve nota ${value.toFixed(1)}, indicando um bom nível de competência com espaço para aprimoramento.`;
  if (value >= 4) return `O critério "${name}" alcançou nota ${value.toFixed(1)}, sugerindo necessidade de desenvolvimento focado nesta área.`;
  return `O critério "${name}" apresentou nota ${value.toFixed(1)}, sendo uma área prioritária para capacitação imediata.`;
};

const getRecommendation = (report: CommercialReport): string => {
  if (report.average_score >= 8) {
    return 'Manter o alto padrão de qualidade e compartilhar as melhores práticas com toda a equipe. Considerar programas de reconhecimento para os colaboradores de destaque.';
  }
  if (report.average_score >= 6) {
    return 'Focar no desenvolvimento das áreas com menor pontuação através de treinamentos específicos. Estabelecer metas progressivas de melhoria para o próximo período.';
  }
  if (report.average_score >= 4) {
    return 'Implementar um plano de ação urgente para elevar a qualidade dos atendimentos. Realizar sessões de coaching individual e monitoramento mais frequente das conversas.';
  }
  return 'Situação crítica que demanda intervenção imediata. Recomenda-se revisão completa dos processos, treinamento intensivo e acompanhamento diário da equipe.';
};

interface Props {
  report: CommercialReport;
  companyName?: string;
}

export function ProfessionalReportPDF({ report, companyName = 'Sua Empresa' }: Props) {
  const classInfo = classificationInfo[report.classification || 'REGULAR'];
  const periodFormatted = `${format(new Date(report.week_start), "dd/MM/yyyy")} - ${format(new Date(report.week_end), "dd/MM/yyyy")}`;
  const generatedAt = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

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
          <Text style={styles.paragraph}>{getExecutiveSummary(report)}</Text>
        </View>

        {/* Classification Highlight */}
        <View style={[styles.highlightBox, { backgroundColor: classInfo.color }]}>
          <Text style={[styles.highlightText, { fontWeight: 'bold', marginBottom: 5 }]}>
            Classificação: {report.classification === 'SEM_DADOS' ? 'Sem Dados' : report.classification}
          </Text>
          <Text style={styles.highlightText}>{classInfo.description}</Text>
        </View>

        {/* Recommendation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recomendação Principal</Text>
          <Text style={styles.paragraph}>{getRecommendation(report)}</Text>
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
            A análise abaixo apresenta o desempenho da equipe em cada critério de avaliação. 
            Cada indicador foi calculado com base nas avaliações realizadas pela inteligência artificial 
            durante o período analisado.
          </Text>
        </View>

        {/* Criteria Bars */}
        <View style={styles.section}>
          {Object.entries(report.criteria_scores || {}).map(([key, value]) => (
            <View key={key} style={styles.criteriaRow}>
              <View style={styles.criteriaHeader}>
                <Text style={styles.criteriaLabel}>{criteriaLabels[key] || key}</Text>
                <Text style={styles.criteriaValue}>{value.toFixed(1)}/10</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${value * 10}%` }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Criteria Descriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análise Detalhada</Text>
          {Object.entries(report.criteria_scores || {}).map(([key, value]) => (
            <Text key={key} style={[styles.paragraph, { marginBottom: 8 }]}>
              {getCriteriaAnalysis(key, value)}
            </Text>
          ))}
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
          {/* Strengths */}
          <View style={styles.column}>
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.success }]}>
              <Text style={[styles.cardTitle, { color: colors.success }]}>✓ Pontos Fortes</Text>
              {report.strengths && report.strengths.length > 0 ? (
                report.strengths.map((strength, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={[styles.listBullet, { color: colors.success }]}>•</Text>
                    <Text style={styles.listText}>{strength}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.listText, { color: colors.gray }]}>
                  Nenhum ponto forte identificado neste período
                </Text>
              )}
            </View>
          </View>

          {/* Weaknesses */}
          <View style={styles.column}>
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.danger }]}>
              <Text style={[styles.cardTitle, { color: colors.danger }]}>⚠ Áreas de Melhoria</Text>
              {report.weaknesses && report.weaknesses.length > 0 ? (
                report.weaknesses.map((weakness, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={[styles.listBullet, { color: colors.danger }]}>•</Text>
                    <Text style={styles.listText}>{weakness}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.listText, { color: colors.gray }]}>
                  Nenhuma área de melhoria identificada
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Agents Performance */}
        {report.agents_analysis && report.agents_analysis.length > 0 && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Performance Individual dos Agentes</Text>
            
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Agente</Text>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Nível</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'center' }]}>Score</Text>
                <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Observação</Text>
              </View>
              {report.agents_analysis.map((agent: any, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { width: '30%', fontWeight: 'bold' }]}>
                    {agent.agent_name || agent.name || 'Agente'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '20%' }]}>
                    {agent.level || 'N/A'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '15%', textAlign: 'center', fontWeight: 'bold', color: colors.primary }]}>
                    {(agent.average_score ?? agent.score)?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '35%' }]}>
                    {agent.recommendation || `${agent.total_conversations || 0} conversas realizadas`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 4</Text>
        </View>
      </Page>

      {/* Insights Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights e Recomendações</Text>
          <Text style={styles.headerDate}>{periodFormatted}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Os insights abaixo foram gerados pela análise de inteligência artificial com base 
            nos padrões identificados nas conversas do período. Utilize essas informações para 
            orientar as ações de melhoria contínua da equipe comercial.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights Identificados</Text>
          {report.insights && report.insights.length > 0 ? (
            report.insights.map((insight, i) => (
              <View key={i} style={styles.insightCard}>
                <Text style={styles.insightText}>
                  <Text style={{ fontWeight: 'bold', color: colors.primary }}>#{i + 1} </Text>
                  {insight}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.insightCard}>
              <Text style={[styles.insightText, { color: colors.gray }]}>
                Nenhum insight específico identificado para este período. 
                Continue monitorando as conversas para obter análises mais detalhadas.
              </Text>
            </View>
          )}
        </View>

        {/* Action Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximos Passos Sugeridos</Text>
          <View style={styles.card}>
            {report.average_score < 6 && (
              <View style={styles.listItem}>
                <Text style={[styles.listBullet, { color: colors.danger }]}>1.</Text>
                <Text style={styles.listText}>
                  Realizar reunião de alinhamento com a equipe para discutir os pontos críticos identificados.
                </Text>
              </View>
            )}
            <View style={styles.listItem}>
              <Text style={[styles.listBullet, { color: colors.primary }]}>
                {report.average_score < 6 ? '2.' : '1.'}
              </Text>
              <Text style={styles.listText}>
                Desenvolver treinamentos focados nos critérios com menor pontuação.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={[styles.listBullet, { color: colors.primary }]}>
                {report.average_score < 6 ? '3.' : '2.'}
              </Text>
              <Text style={styles.listText}>
                Estabelecer metas de melhoria para o próximo período com acompanhamento semanal.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={[styles.listBullet, { color: colors.primary }]}>
                {report.average_score < 6 ? '4.' : '3.'}
              </Text>
              <Text style={styles.listText}>
                Compartilhar as melhores práticas dos agentes de destaque com toda a equipe.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Confidencial - Uso Interno</Text>
          <Text style={styles.pageNumber}>Página 5</Text>
        </View>
      </Page>
    </Document>
  );
}
