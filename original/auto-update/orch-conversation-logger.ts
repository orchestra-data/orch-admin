/**
 * Orch Conversation Logger
 *
 * Sistema de logging de conversas para memoria persistente do Orch.
 * Cada conversa gera um arquivo YAML no diretorio do usuario.
 * Mantem indice por usuario para busca rapida.
 *
 * Estrutura:
 *   logs/{user_id}/index.yaml              -> indice de conversas
 *   logs/{user_id}/YYYY/MM/log.yaml        -> log individual
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TIPOS
// ============================================================

interface ConversationMetadata {
  conversation_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  company_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  total_messages: number;
  pages_visited: string[];
  primary_intent: string;
  overall_sentiment: number;
  resolution_status: 'resolved' | 'partially_resolved' | 'unresolved' | 'escalated';
}

interface EntityMention {
  entity_type: 'student' | 'class' | 'employee' | 'admission' | 'content';
  entity_id: string | null;
  entity_name: string;
  context: string;
  first_mention_turn: number;
}

interface ConversationSummary {
  short_summary: string;
  topics_discussed: string[];
  actions_taken: string[];
  issues_found: string[];
  feedback_collected: string[];
  insights_generated: string[];
  corrections_received: string[];
  unresolved_questions: string[];
}

interface LogMessage {
  turn: number;
  role: 'user' | 'orch';
  content: string;
  timestamp: string;
  page_url: string;
  intent: string;
  sentiment_score: number;
  entities_in_message: string[];
  action_performed: string | null;
}

interface ConversationLog {
  metadata: ConversationMetadata;
  entities_mentioned: EntityMention[];
  summary: ConversationSummary;
  messages: LogMessage[];
}

interface IndexEntry {
  conversation_id: string;
  date: string;
  log_file: string;
  short_summary: string;
  primary_intent: string;
  entities_mentioned: string[];
  resolution_status: string;
  sentiment: number;
  tags: string[];
}

interface UserIndex {
  user_id: string;
  user_name: string;
  total_conversations: number;
  first_interaction: string;
  last_interaction: string;
  preferred_topics: string[];
  frequently_asked: string[];
  known_entities: {
    students: string[];
    classes: string[];
    employees: string[];
    admissions: string[];
  };
  satisfaction_trend: number;
  conversations: IndexEntry[];
}

interface SearchResult {
  conversation_id: string;
  date: string;
  log_file: string;
  short_summary: string;
  relevance_score: number;
  matched_keywords: string[];
  matched_entities: string[];
}

interface ContextPayload {
  user_profile: {
    name: string;
    total_conversations: number;
    preferred_topics: string[];
    frequently_asked: string[];
    known_entities: Record<string, string[]>;
    satisfaction_trend: number;
  };
  recent_summaries: {
    date: string;
    summary: string;
    entities: string[];
    intent: string;
  }[];
  last_conversation: ConversationLog | null;
  relevant_faqs: {
    question: string;
    answer: string;
    frequency: number;
  }[];
  corrections: {
    insight_id: string;
    original: string;
    corrected: string;
  }[];
}

// ============================================================
// CONVERSATION LOGGER
// ============================================================

class ConversationLogger {
  private baseDir: string;
  private currentLog: ConversationLog | null = null;
  private turnCounter = 0;

  constructor(baseDir: string) {
    this.baseDir = path.join(baseDir, 'logs');
  }

  // ----------------------------------------------------------
  // INICIAR CONVERSA
  // ----------------------------------------------------------

  /**
   * Inicia uma nova conversa e prepara o log
   */
  startConversation(
    userId: string,
    userName: string,
    userRole: string,
    companyId: string,
    initialPageUrl: string
  ): string {
    const now = new Date();
    const conversationId = `conv-${this.formatDate(now, 'id')}`;

    this.currentLog = {
      metadata: {
        conversation_id: conversationId,
        user_id: userId,
        user_name: userName,
        user_role: userRole,
        company_id: companyId,
        started_at: now.toISOString(),
        ended_at: '',
        duration_seconds: 0,
        total_messages: 0,
        pages_visited: [initialPageUrl],
        primary_intent: '',
        overall_sentiment: 0,
        resolution_status: 'unresolved',
      },
      entities_mentioned: [],
      summary: {
        short_summary: '',
        topics_discussed: [],
        actions_taken: [],
        issues_found: [],
        feedback_collected: [],
        insights_generated: [],
        corrections_received: [],
        unresolved_questions: [],
      },
      messages: [],
    };

    this.turnCounter = 0;
    return conversationId;
  }

  // ----------------------------------------------------------
  // REGISTRAR MENSAGEM
  // ----------------------------------------------------------

  /**
   * Adiciona uma mensagem ao log da conversa atual
   */
  addMessage(
    role: 'user' | 'orch',
    content: string,
    pageUrl: string,
    intent: string = '',
    sentimentScore: number = 0,
    entitiesInMessage: string[] = [],
    actionPerformed: string | null = null
  ): void {
    if (!this.currentLog) return;

    this.turnCounter++;
    this.currentLog.messages.push({
      turn: this.turnCounter,
      role,
      content: this.truncateContent(content, 500),
      timestamp: new Date().toISOString(),
      page_url: pageUrl,
      intent,
      sentiment_score: sentimentScore,
      entities_in_message: entitiesInMessage,
      action_performed: actionPerformed,
    });

    this.currentLog.metadata.total_messages++;

    // Registrar pagina visitada
    if (!this.currentLog.metadata.pages_visited.includes(pageUrl)) {
      this.currentLog.metadata.pages_visited.push(pageUrl);
    }
  }

  // ----------------------------------------------------------
  // REGISTRAR ENTIDADE MENCIONADA
  // ----------------------------------------------------------

  /**
   * Registra uma entidade mencionada na conversa
   */
  addEntityMention(
    entityType: EntityMention['entity_type'],
    entityName: string,
    entityId: string | null,
    context: string
  ): void {
    if (!this.currentLog) return;

    // Evitar duplicatas
    const exists = this.currentLog.entities_mentioned.find(
      e => e.entity_name === entityName && e.entity_type === entityType
    );
    if (exists) return;

    this.currentLog.entities_mentioned.push({
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      context,
      first_mention_turn: this.turnCounter,
    });
  }

  // ----------------------------------------------------------
  // REGISTRAR ACAO
  // ----------------------------------------------------------

  addAction(action: string): void {
    if (!this.currentLog) return;
    this.currentLog.summary.actions_taken.push(action);
  }

  addIssue(issue: string): void {
    if (!this.currentLog) return;
    this.currentLog.summary.issues_found.push(issue);
  }

  addTopic(topic: string): void {
    if (!this.currentLog) return;
    if (!this.currentLog.summary.topics_discussed.includes(topic)) {
      this.currentLog.summary.topics_discussed.push(topic);
    }
  }

  addFeedbackId(feedbackId: string): void {
    if (!this.currentLog) return;
    this.currentLog.summary.feedback_collected.push(feedbackId);
  }

  addInsightId(insightId: string): void {
    if (!this.currentLog) return;
    this.currentLog.summary.insights_generated.push(insightId);
  }

  addCorrectionId(correctionId: string): void {
    if (!this.currentLog) return;
    this.currentLog.summary.corrections_received.push(correctionId);
  }

  setPrimaryIntent(intent: string): void {
    if (!this.currentLog) return;
    this.currentLog.metadata.primary_intent = intent;
  }

  setResolutionStatus(status: ConversationMetadata['resolution_status']): void {
    if (!this.currentLog) return;
    this.currentLog.metadata.resolution_status = status;
  }

  // ----------------------------------------------------------
  // ENCERRAR E SALVAR CONVERSA
  // ----------------------------------------------------------

  /**
   * Encerra a conversa atual, gera resumo e salva no disco
   */
  async endConversation(shortSummary: string): Promise<string | null> {
    if (!this.currentLog) return null;

    const now = new Date();
    this.currentLog.metadata.ended_at = now.toISOString();
    this.currentLog.metadata.duration_seconds = Math.round(
      (now.getTime() - new Date(this.currentLog.metadata.started_at).getTime()) / 1000
    );

    // Calcular sentimento medio
    const sentiments = this.currentLog.messages
      .filter(m => m.role === 'user')
      .map(m => m.sentiment_score);
    this.currentLog.metadata.overall_sentiment = sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0;

    // Definir resumo
    this.currentLog.summary.short_summary = shortSummary;

    // Salvar arquivo de log
    const logPath = this.saveLog(this.currentLog);

    // Atualizar indice do usuario
    this.updateUserIndex(this.currentLog, logPath);

    const conversationId = this.currentLog.metadata.conversation_id;
    this.currentLog = null;
    this.turnCounter = 0;

    return conversationId;
  }

  // ----------------------------------------------------------
  // SALVAR LOG NO DISCO
  // ----------------------------------------------------------

  private saveLog(log: ConversationLog): string {
    const startDate = new Date(log.metadata.started_at);
    const year = startDate.getFullYear().toString();
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const fileName = this.formatDate(startDate, 'file') + '.yaml';

    const dirPath = path.join(this.baseDir, log.metadata.user_id, year, month);
    const filePath = path.join(dirPath, fileName);
    const relativePath = path.join(year, month, fileName);

    // Garantir diretorio existe
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Serializar para YAML
    const yaml = this.toYaml(log);
    fs.writeFileSync(filePath, yaml, 'utf-8');

    return relativePath;
  }

  // ----------------------------------------------------------
  // INDICE DO USUARIO
  // ----------------------------------------------------------

  private updateUserIndex(log: ConversationLog, logPath: string): void {
    const indexPath = path.join(this.baseDir, log.metadata.user_id, 'index.yaml');
    let index = this.loadUserIndex(log.metadata.user_id);

    if (!index) {
      index = {
        user_id: log.metadata.user_id,
        user_name: log.metadata.user_name,
        total_conversations: 0,
        first_interaction: log.metadata.started_at,
        last_interaction: log.metadata.started_at,
        preferred_topics: [],
        frequently_asked: [],
        known_entities: {
          students: [],
          classes: [],
          employees: [],
          admissions: [],
        },
        satisfaction_trend: 0,
        conversations: [],
      };
    }

    // Adicionar entrada
    const entry: IndexEntry = {
      conversation_id: log.metadata.conversation_id,
      date: log.metadata.started_at,
      log_file: logPath,
      short_summary: log.summary.short_summary,
      primary_intent: log.metadata.primary_intent,
      entities_mentioned: log.entities_mentioned.map(e => e.entity_name),
      resolution_status: log.metadata.resolution_status,
      sentiment: log.metadata.overall_sentiment,
      tags: log.summary.topics_discussed.slice(0, 10),
    };

    index.conversations.push(entry);
    index.total_conversations++;
    index.last_interaction = log.metadata.ended_at;

    // Atualizar entidades conhecidas
    for (const entity of log.entities_mentioned) {
      const key = (entity.entity_type + 's') as keyof typeof index.known_entities;
      if (index.known_entities[key] && !index.known_entities[key].includes(entity.entity_name)) {
        index.known_entities[key].push(entity.entity_name);
      }
    }

    // Recalcular topicos preferidos
    index.preferred_topics = this.calculatePreferredTopics(index.conversations);

    // Recalcular tendencia de satisfacao (ultimas 20 conversas)
    const recentSentiments = index.conversations
      .slice(-20)
      .map(c => c.sentiment);
    index.satisfaction_trend = recentSentiments.length > 0
      ? recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length
      : 0;

    // Salvar indice
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(indexPath, this.toYaml(index), 'utf-8');
  }

  loadUserIndex(userId: string): UserIndex | null {
    const indexPath = path.join(this.baseDir, userId, 'index.yaml');
    if (!fs.existsSync(indexPath)) return null;

    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return this.parseSimpleYaml(content) as UserIndex;
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // CARREGAR CONTEXTO PARA NOVA SESSAO
  // ----------------------------------------------------------

  /**
   * Carrega o contexto do usuario para iniciar uma nova sessao.
   * Retorna: perfil resumido, ultimas conversas, ultima conversa completa, FAQs e correcoes.
   */
  loadUserContext(
    userId: string,
    currentPageUrl: string,
    faqEntries: { question: string; answer: string; frequency: number; module: string; page_url: string }[] = [],
    corrections: { insight_id: string; original_conclusion: string; corrected_conclusion: string }[] = []
  ): ContextPayload {
    const index = this.loadUserIndex(userId);

    if (!index) {
      return {
        user_profile: {
          name: '',
          total_conversations: 0,
          preferred_topics: [],
          frequently_asked: [],
          known_entities: {},
          satisfaction_trend: 0,
        },
        recent_summaries: [],
        last_conversation: null,
        relevant_faqs: [],
        corrections: [],
      };
    }

    // Perfil do usuario
    const userProfile = {
      name: index.user_name,
      total_conversations: index.total_conversations,
      preferred_topics: index.preferred_topics,
      frequently_asked: index.frequently_asked,
      known_entities: index.known_entities,
      satisfaction_trend: index.satisfaction_trend,
    };

    // Resumos recentes (ultimos 30 dias, max 20)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentConvos = index.conversations
      .filter(c => new Date(c.date) >= thirtyDaysAgo)
      .slice(-20);

    const recentSummaries = recentConvos.map(c => ({
      date: c.date,
      summary: c.short_summary,
      entities: c.entities_mentioned,
      intent: c.primary_intent,
    }));

    // Ultima conversa completa (se < 24h)
    let lastConversation: ConversationLog | null = null;
    if (index.conversations.length > 0) {
      const lastEntry = index.conversations[index.conversations.length - 1];
      const lastDate = new Date(lastEntry.date);
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      if (lastDate >= twentyFourHoursAgo) {
        lastConversation = this.loadConversationLog(userId, lastEntry.log_file);
      }
    }

    // FAQs relevantes para a pagina atual
    const relevantFaqs = faqEntries
      .filter(f => {
        // Match por pagina ou modulo
        const pageMatch = currentPageUrl.includes(f.page_url) || f.page_url.includes(currentPageUrl.split('/').slice(0, 3).join('/'));
        return pageMatch && f.frequency >= 2;
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(f => ({
        question: f.question,
        answer: f.answer,
        frequency: f.frequency,
      }));

    // Correcoes de insights
    const relevantCorrections = corrections.map(c => ({
      insight_id: c.insight_id,
      original: c.original_conclusion,
      corrected: c.corrected_conclusion,
    }));

    return {
      user_profile: userProfile,
      recent_summaries: recentSummaries,
      last_conversation: lastConversation,
      relevant_faqs: relevantFaqs,
      corrections: relevantCorrections,
    };
  }

  // ----------------------------------------------------------
  // BUSCA EM CONVERSAS ANTERIORES
  // ----------------------------------------------------------

  /**
   * Busca em conversas anteriores por keywords e entidades.
   * Usado quando o usuario referencia conversa passada.
   */
  searchConversations(
    userId: string,
    keywords: string[],
    entityNames: string[] = [],
    maxResults: number = 5
  ): SearchResult[] {
    const index = this.loadUserIndex(userId);
    if (!index) return [];

    const results: SearchResult[] = [];

    for (const conv of index.conversations) {
      let relevanceScore = 0;
      const matchedKeywords: string[] = [];
      const matchedEntities: string[] = [];

      // Match por keywords no resumo e tags
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        if (conv.short_summary.toLowerCase().includes(kwLower)) {
          relevanceScore += 2;
          matchedKeywords.push(kw);
        }
        if (conv.tags.some(t => t.toLowerCase().includes(kwLower))) {
          relevanceScore += 1;
          matchedKeywords.push(kw);
        }
      }

      // Match por entidades
      for (const entity of entityNames) {
        const entityLower = entity.toLowerCase();
        if (conv.entities_mentioned.some(e => e.toLowerCase().includes(entityLower))) {
          relevanceScore += 3;
          matchedEntities.push(entity);
        }
      }

      if (relevanceScore > 0) {
        results.push({
          conversation_id: conv.conversation_id,
          date: conv.date,
          log_file: conv.log_file,
          short_summary: conv.short_summary,
          relevance_score: relevanceScore,
          matched_keywords: [...new Set(matchedKeywords)],
          matched_entities: [...new Set(matchedEntities)],
        });
      }
    }

    // Ordenar por relevancia (desc) e limitar
    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, maxResults);
  }

  /**
   * Carrega um log de conversa completo a partir do path relativo
   */
  loadConversationLog(userId: string, relativePath: string): ConversationLog | null {
    const fullPath = path.join(this.baseDir, userId, relativePath);
    if (!fs.existsSync(fullPath)) return null;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return this.parseSimpleYaml(content) as ConversationLog;
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // DETECCAO DE REFERENCIA A CONVERSA PASSADA
  // ----------------------------------------------------------

  /**
   * Detecta se a mensagem do usuario referencia uma conversa passada
   */
  detectPastReference(message: string): { isPastReference: boolean; keywords: string[]; timeHint: string | null } {
    const lower = message.toLowerCase();

    const pastPatterns = [
      /lembra\s+(?:quando|que|da)/,
      /outra\s+vez/,
      /da\s+(?:outra\s+)?vez\s+que/,
      /(?:semana|mes|dia)\s+passad[ao]/,
      /(?:ontem|anteontem)/,
      /voce\s+(?:me\s+)?(?:disse|falou|explicou|mostrou)/,
      /a\s+gente\s+(?:conversou|falou|discutiu)/,
      /(?:quem|qual|que)\s+era\s+(?:aquele|aquela)/,
      /(?:lembra|recorda)/,
      /(?:da|na)\s+(?:ultima|penultima)\s+conversa/,
      /(?:ja|antes)\s+(?:me\s+)?(?:perguntei|falei|pedi)/,
    ];

    const isPastReference = pastPatterns.some(p => p.test(lower));

    if (!isPastReference) {
      return { isPastReference: false, keywords: [], timeHint: null };
    }

    // Extrair keywords relevantes (remover stopwords)
    const stopwords = new Set([
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
      'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'que', 'se',
      'eu', 'voce', 'ele', 'ela', 'nao', 'sim', 'mas', 'era', 'foi',
      'lembra', 'quando', 'aquele', 'aquela', 'gente', 'conversou',
      'sobre', 'me', 'disse', 'falou', 'ta', 'tava', 'estava',
    ]);

    const keywords = lower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    // Detectar dica temporal
    let timeHint: string | null = null;
    if (/ontem/.test(lower)) timeHint = 'yesterday';
    else if (/anteontem/.test(lower)) timeHint = 'day_before_yesterday';
    else if (/semana\s+passada/.test(lower)) timeHint = 'last_week';
    else if (/mes\s+passado/.test(lower)) timeHint = 'last_month';
    else if (/ultima\s+conversa/.test(lower)) timeHint = 'last_conversation';

    return { isPastReference, keywords, timeHint };
  }

  // ----------------------------------------------------------
  // ARQUIVAMENTO
  // ----------------------------------------------------------

  /**
   * Arquiva logs com mais de 90 dias (compacta e move para archive/)
   */
  archiveOldLogs(userId: string, daysThreshold: number = 90): number {
    const index = this.loadUserIndex(userId);
    if (!index) return 0;

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysThreshold);
    let archived = 0;

    for (const conv of index.conversations) {
      const convDate = new Date(conv.date);
      if (convDate < threshold) {
        const sourcePath = path.join(this.baseDir, userId, conv.log_file);
        if (fs.existsSync(sourcePath)) {
          const archiveDir = path.join(this.baseDir, userId, 'archive');
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
          }

          const archivePath = path.join(archiveDir, path.basename(conv.log_file));
          fs.renameSync(sourcePath, archivePath);
          conv.log_file = path.join('archive', path.basename(conv.log_file));
          archived++;
        }
      }
    }

    if (archived > 0) {
      const indexPath = path.join(this.baseDir, userId, 'index.yaml');
      fs.writeFileSync(indexPath, this.toYaml(index), 'utf-8');
    }

    return archived;
  }

  // ----------------------------------------------------------
  // UTILIDADES
  // ----------------------------------------------------------

  private calculatePreferredTopics(conversations: IndexEntry[]): string[] {
    const topicCount: Record<string, number> = {};

    // Ultimas 50 conversas
    const recent = conversations.slice(-50);
    for (const conv of recent) {
      for (const tag of conv.tags) {
        topicCount[tag] = (topicCount[tag] || 0) + 1;
      }
    }

    return Object.entries(topicCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic]) => topic);
  }

  private formatDate(date: Date, format: 'id' | 'file'): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');

    if (format === 'id') return `${y}-${m}-${d}-${h}-${min}`;
    return `${y}-${m}-${d}_${h}-${min}-${s}`;
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  private toYaml(obj: unknown, indent: number = 0): string {
    const pad = '  '.repeat(indent);

    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(': ') || obj.includes('#')) {
        return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      }
      return obj.includes(':') || obj.includes('[') || obj.includes('{')
        ? `"${obj}"`
        : obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      if (typeof obj[0] !== 'object') {
        return `[${obj.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`;
      }
      return '\n' + obj.map(item =>
        `${pad}- ${this.toYaml(item, indent + 1).trimStart()}`
      ).join('\n');
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return '{}';
      return '\n' + entries.map(([key, value]) => {
        const yamlValue = this.toYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${pad}${key}:${yamlValue}`;
        }
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          return `${pad}${key}:${yamlValue}`;
        }
        return `${pad}${key}: ${yamlValue}`;
      }).join('\n');
    }

    return String(obj);
  }

  private parseSimpleYaml(content: string): Record<string, unknown> {
    // Parser YAML basico para os formatos usados neste sistema
    // Em producao, usar lib como js-yaml
    try {
      // Tentar JSON parse primeiro (formatos simples)
      return JSON.parse(content);
    } catch {
      // Fallback: retornar objeto vazio e fazer parse manual quando necessario
      return {};
    }
  }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  ConversationLogger,
  ConversationLog,
  ConversationMetadata,
  ConversationSummary,
  EntityMention,
  LogMessage,
  UserIndex,
  IndexEntry,
  SearchResult,
  ContextPayload,
};
