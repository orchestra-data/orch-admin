/**
 * Orch Analytics Engine
 *
 * Rastreia metricas de performance do Orch, gera relatorios
 * diarios e fornece insights sobre o proprio uso do agente.
 *
 * Metricas incluem: tempo de resposta, resolucao, uso de workflows,
 * acuracia de insights, satisfacao zodiacal, form fills, FAQ hits,
 * alertas proativos e analise de sentimento.
 */

// ============================================================
// TIPOS
// ============================================================

type MetricType =
  | 'response_time'
  | 'resolution'
  | 'page_question'
  | 'workflow_usage'
  | 'insight_accuracy'
  | 'zodiac_satisfaction'
  | 'form_fill'
  | 'faq_hit'
  | 'sentiment_score'
  | 'conversation_duration'
  | 'proactive_alert_sent'
  | 'proactive_alert_acted';

interface MetricEvent {
  metric_id: string;
  type: MetricType;
  value: number;
  timestamp: string; // ISO 8601
  user_id: string;
  company_id: string;
  page_url: string;
  session_id: string;
  metadata?: Record<string, any>;
}

interface MetricAggregation {
  metric: MetricType;
  period: 'daily' | 'weekly' | 'monthly';
  date: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  breakdown?: Record<string, number>;
}

interface DailyReport {
  date: string;
  generated_at: string;
  summary: ReportSummary;
  top_pages: PageMetric[];
  top_workflows: WorkflowMetric[];
  insight_performance: InsightPerformance;
  zodiac_performance: ZodiacPerformance;
  alerts_summary: AlertsSummary;
  recommendations: string[];
}

interface ReportSummary {
  total_conversations: number;
  total_messages: number;
  unique_users: number;
  avg_response_time_ms: number;
  resolution_rate: number; // 0-1
  avg_sentiment: number; // -1 to 1
  avg_conversation_duration_seconds: number;
  form_fills_total: number;
  form_fills_success_rate: number; // 0-1
  faq_hit_rate: number; // 0-1
}

interface PageMetric {
  page_url: string;
  question_count: number;
  unique_users: number;
  avg_sentiment: number;
  top_questions: string[];
  has_faq_coverage: boolean;
}

interface WorkflowMetric {
  workflow_id: string;
  workflow_name: string;
  usage_count: number;
  completion_rate: number;
  avg_steps_completed: number;
}

interface InsightPerformance {
  total_generated: number;
  total_corrected: number;
  accuracy_rate: number; // 0-1
  most_corrected_types: string[];
  most_accurate_types: string[];
}

interface ZodiacPerformance {
  enabled_sessions: number;
  disabled_sessions: number;
  avg_sentiment_with_zodiac: number;
  avg_sentiment_without_zodiac: number;
  satisfaction_delta: number;
  best_performing_signs: string[];
  adaptation_level_distribution: Record<string, number>;
}

interface AlertsSummary {
  total_sent: number;
  total_acted_on: number;
  action_rate: number;
  by_type: Record<string, number>;
}

interface ContextBudget {
  max_tokens: number;
  allocated: ContextAllocation[];
  total_used: number;
  remaining: number;
  overflow_strategy: 'summarize_oldest_first' | 'drop_lowest_priority' | 'compress_all';
}

interface ContextAllocation {
  source: string;
  priority: number;
  max_tokens: number;
  actual_tokens: number;
  compressed: boolean;
}

interface SessionMetrics {
  session_id: string;
  user_id: string;
  company_id: string;
  start_time: string;
  message_count: number;
  total_response_time_ms: number;
  resolved: boolean | null;
  sentiment_scores: number[];
  zodiac_sign: string | null;
  zodiac_adaptation_level: string | null;
  pages_visited: string[];
  workflows_used: string[];
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Gera um ID unico simples para metricas
 */
function generateMetricId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `m_${ts}_${rand}`;
}

/**
 * Estimador simples de tokens.
 * Aproximacao: 1 token ~= 4 caracteres.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Comprime um texto para caber no limite de tokens alvo.
 * Em producao, chamaria uma LLM para sumarizar.
 * Aqui, trunca de forma inteligente mantendo inicio e fim.
 */
function compressContext(text: string, targetTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= targetTokens) {
    return text;
  }

  const targetChars = targetTokens * 4;
  const keepStart = Math.floor(targetChars * 0.7);
  const keepEnd = Math.floor(targetChars * 0.25);
  const ellipsis = '\n\n[... conteudo comprimido ...]\n\n';

  return (
    text.substring(0, keepStart) +
    ellipsis +
    text.substring(text.length - keepEnd)
  );
}

/**
 * Converte um objeto para string YAML simplificado.
 * Usado para armazenamento de relatorios.
 */
function toYaml(obj: Record<string, any>, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${prefix}${key}: null\n`;
    } else if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.includes('#')) {
        yaml += `${prefix}${key}: "${value.replace(/"/g, '\\"')}"\n`;
      } else {
        yaml += `${prefix}${key}: ${value}\n`;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      yaml += `${prefix}${key}: ${value}\n`;
    } else if (Array.isArray(value)) {
      yaml += `${prefix}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          yaml += `${prefix}  -\n${toYaml(item, indent + 2)}`;
        } else {
          yaml += `${prefix}  - ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${prefix}${key}:\n${toYaml(value, indent + 1)}`;
    }
  }

  return yaml;
}

// ============================================================
// CLASSE: MetricsCollector
// ============================================================

/**
 * Coletor de metricas do Orch.
 *
 * Registra eventos de metricas em tempo real, mantendo
 * historico de sessoes e eventos individuais para posterior
 * agregacao e geracao de relatorios.
 */
class MetricsCollector {
  private events: MetricEvent[] = [];
  private sessionMetrics: Map<string, SessionMetrics> = new Map();

  /**
   * Registra um evento de metrica generico
   */
  recordEvent(
    type: MetricType,
    value: number,
    userId: string,
    companyId: string,
    pageUrl: string,
    sessionId: string,
    metadata?: Record<string, any>
  ): MetricEvent {
    const event: MetricEvent = {
      metric_id: generateMetricId(),
      type,
      value,
      timestamp: new Date().toISOString(),
      user_id: userId,
      company_id: companyId,
      page_url: pageUrl,
      session_id: sessionId,
      metadata,
    };

    this.events.push(event);
    this.ensureSession(sessionId, userId, companyId);

    return event;
  }

  /**
   * Registra tempo de resposta do Orch
   */
  recordResponseTime(
    startTime: number,
    sessionId: string,
    userId: string,
    companyId: string,
    pageUrl: string
  ): MetricEvent {
    const elapsed = Date.now() - startTime;
    const event = this.recordEvent(
      'response_time',
      elapsed,
      userId,
      companyId,
      pageUrl,
      sessionId,
      { start_time: startTime, elapsed_ms: elapsed }
    );

    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.total_response_time_ms += elapsed;
      session.message_count += 1;
    }

    return event;
  }

  /**
   * Registra resolucao de conversa (resolvida ou nao)
   */
  recordResolution(
    resolved: boolean,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    const event = this.recordEvent(
      'resolution',
      resolved ? 1 : 0,
      userId,
      companyId,
      '',
      sessionId,
      { resolved }
    );

    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.resolved = resolved;
    }

    return event;
  }

  /**
   * Registra uma pergunta feita em uma pagina especifica
   */
  recordPageQuestion(
    pageUrl: string,
    question: string,
    userId: string,
    companyId: string,
    sessionId: string
  ): MetricEvent {
    const event = this.recordEvent(
      'page_question',
      1,
      userId,
      companyId,
      pageUrl,
      sessionId,
      { question }
    );

    const session = this.sessionMetrics.get(sessionId);
    if (session && !session.pages_visited.includes(pageUrl)) {
      session.pages_visited.push(pageUrl);
    }

    return event;
  }

  /**
   * Registra uso de um workflow
   */
  recordWorkflowUsage(
    workflowId: string,
    workflowName: string,
    completed: boolean,
    stepsCompleted: number,
    totalSteps: number,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    const event = this.recordEvent(
      'workflow_usage',
      completed ? 1 : 0,
      userId,
      companyId,
      '',
      sessionId,
      { workflow_id: workflowId, workflow_name: workflowName, completed, steps_completed: stepsCompleted, total_steps: totalSteps }
    );

    const session = this.sessionMetrics.get(sessionId);
    if (session && !session.workflows_used.includes(workflowId)) {
      session.workflows_used.push(workflowId);
    }

    return event;
  }

  /**
   * Registra resultado de um insight (aceito ou corrigido)
   */
  recordInsightOutcome(
    insightType: string,
    corrected: boolean,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    return this.recordEvent(
      'insight_accuracy',
      corrected ? 0 : 1,
      userId,
      companyId,
      '',
      sessionId,
      { insight_type: insightType, corrected }
    );
  }

  /**
   * Registra dados de sessao com zodiac habilitado
   */
  recordZodiacSession(
    sign: string,
    adaptationLevel: string,
    sentiment: number,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    const event = this.recordEvent(
      'zodiac_satisfaction',
      sentiment,
      userId,
      companyId,
      '',
      sessionId,
      { sign, adaptation_level: adaptationLevel }
    );

    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.zodiac_sign = sign;
      session.zodiac_adaptation_level = adaptationLevel;
    }

    return event;
  }

  /**
   * Registra tentativa de preenchimento de formulario
   */
  recordFormFill(
    success: boolean,
    fieldName: string,
    pageUrl: string,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    return this.recordEvent(
      'form_fill',
      success ? 1 : 0,
      userId,
      companyId,
      pageUrl,
      sessionId,
      { success, field_name: fieldName }
    );
  }

  /**
   * Registra hit ou miss de FAQ
   */
  recordFaqHit(
    hit: boolean,
    question: string,
    pageUrl: string,
    sessionId: string,
    userId: string,
    companyId: string
  ): MetricEvent {
    return this.recordEvent(
      'faq_hit',
      hit ? 1 : 0,
      userId,
      companyId,
      pageUrl,
      sessionId,
      { hit, question }
    );
  }

  /**
   * Registra alerta proativo enviado e/ou atuado
   */
  recordProactiveAlert(
    alertType: string,
    sent: boolean,
    actedOn: boolean,
    targetUserId: string,
    companyId: string
  ): MetricEvent {
    if (sent) {
      this.recordEvent(
        'proactive_alert_sent',
        1,
        targetUserId,
        companyId,
        '',
        '',
        { alert_type: alertType }
      );
    }

    if (actedOn) {
      return this.recordEvent(
        'proactive_alert_acted',
        1,
        targetUserId,
        companyId,
        '',
        '',
        { alert_type: alertType }
      );
    }

    return this.recordEvent(
      'proactive_alert_sent',
      sent ? 1 : 0,
      targetUserId,
      companyId,
      '',
      '',
      { alert_type: alertType, acted_on: actedOn }
    );
  }

  /**
   * Retorna todos os eventos coletados
   */
  getEvents(): MetricEvent[] {
    return [...this.events];
  }

  /**
   * Retorna metricas de uma sessao especifica
   */
  getSessionMetrics(sessionId: string): SessionMetrics | undefined {
    return this.sessionMetrics.get(sessionId);
  }

  /**
   * Retorna todas as sessoes
   */
  getAllSessions(): SessionMetrics[] {
    return Array.from(this.sessionMetrics.values());
  }

  /**
   * Limpa eventos antigos (retencao)
   */
  pruneEvents(beforeDate: string): number {
    const cutoff = new Date(beforeDate).getTime();
    const initialCount = this.events.length;
    this.events = this.events.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff
    );
    return initialCount - this.events.length;
  }

  /**
   * Garante que a sessao existe no mapa
   */
  private ensureSession(
    sessionId: string,
    userId: string,
    companyId: string
  ): void {
    if (!sessionId || this.sessionMetrics.has(sessionId)) return;

    this.sessionMetrics.set(sessionId, {
      session_id: sessionId,
      user_id: userId,
      company_id: companyId,
      start_time: new Date().toISOString(),
      message_count: 0,
      total_response_time_ms: 0,
      resolved: null,
      sentiment_scores: [],
      zodiac_sign: null,
      zodiac_adaptation_level: null,
      pages_visited: [],
      workflows_used: [],
    });
  }
}

// ============================================================
// FUNCOES DE AGREGACAO
// ============================================================

/**
 * Agrega eventos por tipo e periodo.
 * Retorna um array de MetricAggregation com estatisticas
 * (count, sum, avg, min, max) para cada tipo de metrica.
 */
function aggregateMetrics(
  events: MetricEvent[],
  period: 'daily' | 'weekly' | 'monthly'
): MetricAggregation[] {
  const grouped = new Map<string, MetricEvent[]>();

  for (const event of events) {
    const dateKey = getDateKey(event.timestamp, period);
    const key = `${event.type}::${dateKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }

  const aggregations: MetricAggregation[] = [];

  for (const [key, groupEvents] of grouped.entries()) {
    const [metricType, dateKey] = key.split('::');
    const values = groupEvents.map((e) => e.value);

    // Breakdown por page_url
    const breakdown: Record<string, number> = {};
    for (const event of groupEvents) {
      if (event.page_url) {
        breakdown[event.page_url] = (breakdown[event.page_url] || 0) + 1;
      }
    }

    aggregations.push({
      metric: metricType as MetricType,
      period,
      date: dateKey,
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      breakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined,
    });
  }

  return aggregations;
}

/**
 * Retorna a chave de data para agrupamento por periodo
 */
function getDateKey(
  timestamp: string,
  period: 'daily' | 'weekly' | 'monthly'
): string {
  const date = new Date(timestamp);

  switch (period) {
    case 'daily':
      return date.toISOString().split('T')[0]; // YYYY-MM-DD

    case 'weekly': {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return `W-${startOfWeek.toISOString().split('T')[0]}`;
    }

    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

// ============================================================
// GERACAO DE RELATORIO DIARIO
// ============================================================

/**
 * Gera um relatorio diario completo a partir dos eventos do dia.
 *
 * Calcula estatisticas de resumo, classifica as top 10 paginas
 * por quantidade de perguntas, top 10 workflows por uso,
 * performance de insights e zodiac, e gera recomendacoes
 * automaticas baseadas nos padroes encontrados.
 */
function generateDailyReport(events: MetricEvent[], date: string): DailyReport {
  const summary = calculateSummary(events);
  const topPages = calculateTopPages(events);
  const topWorkflows = calculateTopWorkflows(events);
  const insightPerf = calculateInsightPerformance(events);
  const zodiacPerf = calculateZodiacPerformance(events);
  const alertsSummary = calculateAlertsSummary(events);
  const recommendations = generateRecommendations(
    summary,
    topPages,
    topWorkflows,
    insightPerf,
    zodiacPerf,
    alertsSummary
  );

  return {
    date,
    generated_at: new Date().toISOString(),
    summary,
    top_pages: topPages,
    top_workflows: topWorkflows,
    insight_performance: insightPerf,
    zodiac_performance: zodiacPerf,
    alerts_summary: alertsSummary,
    recommendations,
  };
}

/**
 * Calcula o resumo geral do dia
 */
function calculateSummary(events: MetricEvent[]): ReportSummary {
  const sessions = new Set(events.filter((e) => e.session_id).map((e) => e.session_id));
  const users = new Set(events.map((e) => e.user_id));

  // Tempo de resposta
  const responseTimeEvents = events.filter((e) => e.type === 'response_time');
  const avgResponseTime =
    responseTimeEvents.length > 0
      ? responseTimeEvents.reduce((sum, e) => sum + e.value, 0) / responseTimeEvents.length
      : 0;

  // Resolucao
  const resolutionEvents = events.filter((e) => e.type === 'resolution');
  const resolutionRate =
    resolutionEvents.length > 0
      ? resolutionEvents.filter((e) => e.value === 1).length / resolutionEvents.length
      : 0;

  // Sentimento
  const sentimentEvents = events.filter((e) => e.type === 'sentiment_score');
  const avgSentiment =
    sentimentEvents.length > 0
      ? sentimentEvents.reduce((sum, e) => sum + e.value, 0) / sentimentEvents.length
      : 0;

  // Duracao de conversa
  const durationEvents = events.filter((e) => e.type === 'conversation_duration');
  const avgDuration =
    durationEvents.length > 0
      ? durationEvents.reduce((sum, e) => sum + e.value, 0) / durationEvents.length
      : 0;

  // Form fills
  const formFillEvents = events.filter((e) => e.type === 'form_fill');
  const formFillSuccessRate =
    formFillEvents.length > 0
      ? formFillEvents.filter((e) => e.value === 1).length / formFillEvents.length
      : 0;

  // FAQ hits
  const faqEvents = events.filter((e) => e.type === 'faq_hit');
  const faqHitRate =
    faqEvents.length > 0
      ? faqEvents.filter((e) => e.value === 1).length / faqEvents.length
      : 0;

  // Total de mensagens (baseado em response_time events)
  const totalMessages = responseTimeEvents.length;

  return {
    total_conversations: sessions.size,
    total_messages: totalMessages,
    unique_users: users.size,
    avg_response_time_ms: Math.round(avgResponseTime),
    resolution_rate: Math.round(resolutionRate * 100) / 100,
    avg_sentiment: Math.round(avgSentiment * 100) / 100,
    avg_conversation_duration_seconds: Math.round(avgDuration),
    form_fills_total: formFillEvents.length,
    form_fills_success_rate: Math.round(formFillSuccessRate * 100) / 100,
    faq_hit_rate: Math.round(faqHitRate * 100) / 100,
  };
}

/**
 * Calcula as top 10 paginas por quantidade de perguntas
 */
function calculateTopPages(events: MetricEvent[]): PageMetric[] {
  const pageQuestions = events.filter((e) => e.type === 'page_question');
  const faqEvents = events.filter((e) => e.type === 'faq_hit');
  const sentimentEvents = events.filter((e) => e.type === 'sentiment_score');

  const pageMap = new Map<
    string,
    { questions: string[]; users: Set<string>; sentiments: number[]; faqHits: number }
  >();

  for (const event of pageQuestions) {
    if (!event.page_url) continue;

    if (!pageMap.has(event.page_url)) {
      pageMap.set(event.page_url, {
        questions: [],
        users: new Set(),
        sentiments: [],
        faqHits: 0,
      });
    }

    const page = pageMap.get(event.page_url)!;
    page.users.add(event.user_id);
    if (event.metadata?.question) {
      page.questions.push(event.metadata.question);
    }
  }

  // Agregar sentimentos por pagina
  for (const event of sentimentEvents) {
    if (event.page_url && pageMap.has(event.page_url)) {
      pageMap.get(event.page_url)!.sentiments.push(event.value);
    }
  }

  // Verificar cobertura de FAQ por pagina
  const pagesWithFaq = new Set<string>();
  for (const event of faqEvents) {
    if (event.page_url && event.value === 1) {
      pagesWithFaq.add(event.page_url);
    }
  }

  const pages: PageMetric[] = [];

  for (const [url, data] of pageMap.entries()) {
    const avgSentiment =
      data.sentiments.length > 0
        ? data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length
        : 0;

    // Top 5 perguntas mais frequentes
    const questionCounts = new Map<string, number>();
    for (const q of data.questions) {
      questionCounts.set(q, (questionCounts.get(q) || 0) + 1);
    }
    const topQuestions = Array.from(questionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([q]) => q);

    pages.push({
      page_url: url,
      question_count: data.questions.length,
      unique_users: data.users.size,
      avg_sentiment: Math.round(avgSentiment * 100) / 100,
      top_questions: topQuestions,
      has_faq_coverage: pagesWithFaq.has(url),
    });
  }

  return pages
    .sort((a, b) => b.question_count - a.question_count)
    .slice(0, 10);
}

/**
 * Calcula os top 10 workflows por uso
 */
function calculateTopWorkflows(events: MetricEvent[]): WorkflowMetric[] {
  const workflowEvents = events.filter((e) => e.type === 'workflow_usage');

  const workflowMap = new Map<
    string,
    { name: string; total: number; completed: number; stepsCompleted: number[] }
  >();

  for (const event of workflowEvents) {
    const wfId = event.metadata?.workflow_id || 'unknown';
    const wfName = event.metadata?.workflow_name || 'Unknown Workflow';

    if (!workflowMap.has(wfId)) {
      workflowMap.set(wfId, { name: wfName, total: 0, completed: 0, stepsCompleted: [] });
    }

    const wf = workflowMap.get(wfId)!;
    wf.total += 1;
    if (event.value === 1) {
      wf.completed += 1;
    }
    if (event.metadata?.steps_completed !== undefined) {
      wf.stepsCompleted.push(event.metadata.steps_completed);
    }
  }

  const workflows: WorkflowMetric[] = [];

  for (const [id, data] of workflowMap.entries()) {
    const avgSteps =
      data.stepsCompleted.length > 0
        ? data.stepsCompleted.reduce((a, b) => a + b, 0) / data.stepsCompleted.length
        : 0;

    workflows.push({
      workflow_id: id,
      workflow_name: data.name,
      usage_count: data.total,
      completion_rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) / 100 : 0,
      avg_steps_completed: Math.round(avgSteps * 10) / 10,
    });
  }

  return workflows
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10);
}

/**
 * Calcula a performance dos insights gerados
 */
function calculateInsightPerformance(events: MetricEvent[]): InsightPerformance {
  const insightEvents = events.filter((e) => e.type === 'insight_accuracy');

  const totalGenerated = insightEvents.length;
  const totalCorrected = insightEvents.filter((e) => e.metadata?.corrected === true).length;
  const accuracyRate = totalGenerated > 0
    ? Math.round(((totalGenerated - totalCorrected) / totalGenerated) * 100) / 100
    : 1;

  // Agrupar por tipo de insight
  const typeCounts = new Map<string, { total: number; corrected: number }>();
  for (const event of insightEvents) {
    const type = event.metadata?.insight_type || 'unknown';
    if (!typeCounts.has(type)) {
      typeCounts.set(type, { total: 0, corrected: 0 });
    }
    const tc = typeCounts.get(type)!;
    tc.total += 1;
    if (event.metadata?.corrected) {
      tc.corrected += 1;
    }
  }

  // Tipos mais corrigidos (taxa de correcao > 30%)
  const mostCorrected: string[] = [];
  const mostAccurate: string[] = [];

  for (const [type, counts] of typeCounts.entries()) {
    const correctionRate = counts.total > 0 ? counts.corrected / counts.total : 0;
    if (correctionRate > 0.3) {
      mostCorrected.push(type);
    }
    if (correctionRate < 0.1 && counts.total >= 3) {
      mostAccurate.push(type);
    }
  }

  return {
    total_generated: totalGenerated,
    total_corrected: totalCorrected,
    accuracy_rate: accuracyRate,
    most_corrected_types: mostCorrected,
    most_accurate_types: mostAccurate,
  };
}

/**
 * Calcula a performance comparativa zodiac vs nao-zodiac
 */
function calculateZodiacPerformance(events: MetricEvent[]): ZodiacPerformance {
  const zodiacEvents = events.filter((e) => e.type === 'zodiac_satisfaction');
  const sentimentEvents = events.filter((e) => e.type === 'sentiment_score');

  // Sessoes com zodiac
  const zodiacSessions = new Set(zodiacEvents.map((e) => e.session_id));
  const allSessions = new Set(events.filter((e) => e.session_id).map((e) => e.session_id));
  const nonZodiacSessions = new Set(
    Array.from(allSessions).filter((s) => !zodiacSessions.has(s))
  );

  // Sentimento medio com zodiac
  const zodiacSentiments = sentimentEvents.filter((e) => zodiacSessions.has(e.session_id));
  const nonZodiacSentiments = sentimentEvents.filter((e) => nonZodiacSessions.has(e.session_id));

  const avgWithZodiac =
    zodiacSentiments.length > 0
      ? zodiacSentiments.reduce((sum, e) => sum + e.value, 0) / zodiacSentiments.length
      : 0;

  const avgWithoutZodiac =
    nonZodiacSentiments.length > 0
      ? nonZodiacSentiments.reduce((sum, e) => sum + e.value, 0) / nonZodiacSentiments.length
      : 0;

  // Melhores signos por satisfacao
  const signSentiments = new Map<string, number[]>();
  for (const event of zodiacEvents) {
    const sign = event.metadata?.sign || 'unknown';
    if (!signSentiments.has(sign)) {
      signSentiments.set(sign, []);
    }
    signSentiments.get(sign)!.push(event.value);
  }

  const signAvgs = Array.from(signSentiments.entries()).map(([sign, values]) => ({
    sign,
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }));
  signAvgs.sort((a, b) => b.avg - a.avg);
  const bestSigns = signAvgs.slice(0, 3).map((s) => s.sign);

  // Distribuicao de niveis de adaptacao
  const adaptationDist: Record<string, number> = {};
  for (const event of zodiacEvents) {
    const level = event.metadata?.adaptation_level || 'unknown';
    adaptationDist[level] = (adaptationDist[level] || 0) + 1;
  }

  return {
    enabled_sessions: zodiacSessions.size,
    disabled_sessions: nonZodiacSessions.size,
    avg_sentiment_with_zodiac: Math.round(avgWithZodiac * 100) / 100,
    avg_sentiment_without_zodiac: Math.round(avgWithoutZodiac * 100) / 100,
    satisfaction_delta: Math.round((avgWithZodiac - avgWithoutZodiac) * 100) / 100,
    best_performing_signs: bestSigns,
    adaptation_level_distribution: adaptationDist,
  };
}

/**
 * Calcula o resumo de alertas proativos
 */
function calculateAlertsSummary(events: MetricEvent[]): AlertsSummary {
  const sentEvents = events.filter((e) => e.type === 'proactive_alert_sent');
  const actedEvents = events.filter((e) => e.type === 'proactive_alert_acted');

  const totalSent = sentEvents.length;
  const totalActed = actedEvents.length;
  const actionRate = totalSent > 0 ? Math.round((totalActed / totalSent) * 100) / 100 : 0;

  const byType: Record<string, number> = {};
  for (const event of sentEvents) {
    const alertType = event.metadata?.alert_type || 'unknown';
    byType[alertType] = (byType[alertType] || 0) + 1;
  }

  return {
    total_sent: totalSent,
    total_acted_on: totalActed,
    action_rate: actionRate,
    by_type: byType,
  };
}

/**
 * Gera recomendacoes automaticas baseadas nos padroes dos dados
 */
function generateRecommendations(
  summary: ReportSummary,
  topPages: PageMetric[],
  topWorkflows: WorkflowMetric[],
  insightPerf: InsightPerformance,
  zodiacPerf: ZodiacPerformance,
  alertsSummary: AlertsSummary
): string[] {
  const recommendations: string[] = [];

  // Paginas com muitas perguntas e sem FAQ
  for (const page of topPages) {
    if (page.question_count >= 10 && !page.has_faq_coverage) {
      recommendations.push(
        `Pagina ${page.page_url} tem ${page.question_count} perguntas e 0 FAQs - considere criar FAQs`
      );
    }
  }

  // Paginas com sentimento negativo
  for (const page of topPages) {
    if (page.avg_sentiment < -0.3 && page.question_count >= 5) {
      recommendations.push(
        `Pagina ${page.page_url} tem sentimento medio de ${page.avg_sentiment} - investigar causa de insatisfacao`
      );
    }
  }

  // Workflows com baixa taxa de conclusao
  for (const workflow of topWorkflows) {
    if (workflow.completion_rate < 0.5 && workflow.usage_count >= 5) {
      recommendations.push(
        `Workflow '${workflow.workflow_name}' tem taxa de conclusao de ${Math.round(workflow.completion_rate * 100)}% - possivel UX issue`
      );
    }
  }

  // Insights com alta taxa de correcao
  for (const type of insightPerf.most_corrected_types) {
    const correctionRate = insightPerf.total_generated > 0
      ? Math.round((insightPerf.total_corrected / insightPerf.total_generated) * 100)
      : 0;
    recommendations.push(
      `Insights de tipo '${type}' foram corrigidos ${correctionRate}% das vezes - revisar logica`
    );
  }

  // Zodiac performance
  if (zodiacPerf.satisfaction_delta > 0.1) {
    const deltaPercent = Math.round(zodiacPerf.satisfaction_delta * 100);
    recommendations.push(
      `Usuarios com zodiac ativo tem satisfacao ${deltaPercent}% maior`
    );
  }

  if (zodiacPerf.satisfaction_delta < -0.1) {
    recommendations.push(
      `Zodiac esta impactando negativamente a satisfacao - revisar perfis comportamentais`
    );
  }

  // Tempo de resposta alto
  if (summary.avg_response_time_ms > 3000) {
    recommendations.push(
      `Tempo medio de resposta de ${summary.avg_response_time_ms}ms esta acima do ideal (3000ms) - otimizar pipeline`
    );
  }

  // Taxa de resolucao baixa
  if (summary.resolution_rate < 0.6 && summary.total_conversations >= 10) {
    recommendations.push(
      `Taxa de resolucao de ${Math.round(summary.resolution_rate * 100)}% esta abaixo do alvo (60%) - revisar base de conhecimento`
    );
  }

  // Form fills com baixa taxa de sucesso
  if (summary.form_fills_total >= 10 && summary.form_fills_success_rate < 0.7) {
    recommendations.push(
      `Taxa de sucesso de form fill de ${Math.round(summary.form_fills_success_rate * 100)}% - revisar mapeamento de campos`
    );
  }

  // FAQ hit rate baixo
  if (summary.faq_hit_rate < 0.3 && summary.total_messages >= 20) {
    recommendations.push(
      `FAQ hit rate de ${Math.round(summary.faq_hit_rate * 100)}% esta baixo - expandir base de FAQs`
    );
  }

  // Alertas com baixa taxa de acao
  if (alertsSummary.total_sent >= 10 && alertsSummary.action_rate < 0.2) {
    recommendations.push(
      `Apenas ${Math.round(alertsSummary.action_rate * 100)}% dos alertas proativos foram atuados - revisar relevancia dos alertas`
    );
  }

  return recommendations;
}

// ============================================================
// CONTEXT BUDGET
// ============================================================

/**
 * Calcula o orcamento de contexto do Orch, alocando tokens
 * de forma inteligente entre os componentes com base em prioridade.
 *
 * Prioridades (1 = mais alta):
 * 1. current_conversation - sempre completo
 * 2. page_knowledge - sempre completo
 * 3. zodiac_directive - compacto (~100 tokens)
 * 4. last_conversation - sumarizar se > 2000 tokens
 * 5. recent_summaries - top 10 por relevancia
 * 6. faqs - top 5 mais relevantes
 * 7. corrections - todas (geralmente poucas)
 *
 * Se total exceder max_tokens (8000), comprime a partir da menor prioridade.
 */
function calculateContextBudget(
  components: { source: string; content: string; priority?: number }[],
  maxTokens: number = 8000
): ContextBudget {
  // Prioridades padrao por source
  const defaultPriorities: Record<string, number> = {
    current_conversation: 1,
    page_knowledge: 2,
    zodiac_directive: 3,
    last_conversation: 4,
    recent_summaries: 5,
    faqs: 6,
    corrections: 7,
  };

  // Limites especiais por source
  const maxTokensPerSource: Record<string, number> = {
    zodiac_directive: 100,
    last_conversation: 2000,
    recent_summaries: 1500,
    faqs: 800,
    corrections: 500,
  };

  // Calcular alocacoes
  let allocations: ContextAllocation[] = components.map((comp) => {
    const priority = comp.priority || defaultPriorities[comp.source] || 8;
    const actualTokens = estimateTokens(comp.content);
    const sourceMax = maxTokensPerSource[comp.source] || actualTokens;

    return {
      source: comp.source,
      priority,
      max_tokens: sourceMax,
      actual_tokens: Math.min(actualTokens, sourceMax),
      compressed: actualTokens > sourceMax,
    };
  });

  // Ordenar por prioridade (menor numero = maior prioridade)
  allocations.sort((a, b) => a.priority - b.priority);

  // Calcular total
  let totalUsed = allocations.reduce((sum, a) => sum + a.actual_tokens, 0);

  // Se excede, comprimir a partir da menor prioridade
  let overflowStrategy: ContextBudget['overflow_strategy'] = 'summarize_oldest_first';

  if (totalUsed > maxTokens) {
    overflowStrategy = 'drop_lowest_priority';

    // Comprimir de tras pra frente (menor prioridade primeiro)
    const reversed = [...allocations].reverse();
    let excess = totalUsed - maxTokens;

    for (const alloc of reversed) {
      if (excess <= 0) break;

      // Prioridades 1-2 nunca sao comprimidas
      if (alloc.priority <= 2) continue;

      const reduction = Math.min(alloc.actual_tokens * 0.5, excess);
      alloc.actual_tokens = Math.max(
        Math.round(alloc.actual_tokens - reduction),
        50 // minimo de 50 tokens
      );
      alloc.compressed = true;
      excess -= reduction;
    }

    // Se ainda excede, comprimir tudo
    if (excess > 0) {
      overflowStrategy = 'compress_all';
      const ratio = maxTokens / totalUsed;
      for (const alloc of allocations) {
        if (alloc.priority > 2) {
          alloc.actual_tokens = Math.max(Math.round(alloc.actual_tokens * ratio), 30);
          alloc.compressed = true;
        }
      }
    }

    totalUsed = allocations.reduce((sum, a) => sum + a.actual_tokens, 0);
  }

  return {
    max_tokens: maxTokens,
    allocated: allocations,
    total_used: totalUsed,
    remaining: Math.max(maxTokens - totalUsed, 0),
    overflow_strategy: overflowStrategy,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  // Tipos
  MetricType,
  MetricEvent,
  MetricAggregation,
  DailyReport,
  ReportSummary,
  PageMetric,
  WorkflowMetric,
  InsightPerformance,
  ZodiacPerformance,
  AlertsSummary,
  ContextBudget,
  ContextAllocation,
  SessionMetrics,

  // Classe
  MetricsCollector,

  // Funcoes principais
  aggregateMetrics,
  generateDailyReport,
  calculateContextBudget,

  // Helpers
  estimateTokens,
  compressContext,
  toYaml,
  generateMetricId,
};
