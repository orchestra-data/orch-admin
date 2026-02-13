/**
 * Orch Feedback Handler
 *
 * Gerencia o banco de FAQs e Improvements do Orch.
 * Chamado pelo agente quando detecta sentimento negativo ou
 * quando o usuario reporta feedback proativamente.
 *
 * Funcionalidades:
 * - Adicionar FAQ ao banco
 * - Adicionar improvement (feature, adjustment, bug, ux_issue)
 * - Detectar duplicatas e incrementar frequencia
 * - Gerar relatorio diario
 * - Buscar FAQs similares
 *
 * Uso: npx tsx orch-feedback.ts --action=add-faq --data='...'
 *      npx tsx orch-feedback.ts --action=add-improvement --data='...'
 *      npx tsx orch-feedback.ts --action=daily-report
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// ============================================================================
// TYPES
// ============================================================================

interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  module: string;
  page_url: string;
  frequency: number;
  first_asked: string;
  last_asked: string;
  asked_by_count: number;
  status: 'active' | 'archived' | 'merged';
  tags: string[];
  related_faqs: string[];
}

interface ImprovementEntry {
  id: string;
  type: 'feature_request' | 'adjustment' | 'bug_report' | 'ux_issue';
  title: string;
  description: string;
  user_verbatim: string;
  module: string;
  page_url: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_review' | 'accepted' | 'rejected' | 'implemented';
  reported_at: string;
  reported_by_role: string;
  frequency: number;
  similar_reports: string[];
  impact: string;
  suggested_solution: string;
  tags: string[];
  conversation_context: {
    sentiment: string;
    trigger: string;
    orch_questions_asked: number;
  };
  // Bug-specific fields
  steps_to_reproduce?: string[];
  expected_behavior?: string;
  actual_behavior?: string;
  workaround?: string;
}

interface FAQBank {
  metadata: {
    version: string;
    description: string;
    created_at: string;
    last_updated: string;
    total_entries: number;
    auto_generated: boolean;
  };
  categories: Array<{ id: string; label: string; description: string }>;
  entries: FAQEntry[];
}

interface ImprovementsBank {
  metadata: {
    version: string;
    description: string;
    created_at: string;
    last_updated: string;
    total_entries: number;
    stats: {
      feature_requests: number;
      adjustments: number;
      bug_reports: number;
      ux_issues: number;
    };
  };
  entries: ImprovementEntry[];
}

interface DailyReport {
  date: string;
  generated_at: string;
  summary: {
    total_feedbacks: number;
    by_type: Record<string, number>;
    new_faqs: number;
    top_pages: Array<{ page: string; count: number }>;
    top_improvements: Array<{ title: string; frequency: number; type: string }>;
  };
  new_entries: Array<{ id: string; type: string; title: string }>;
}

// ============================================================================
// SENTIMENT DETECTION
// ============================================================================

const FRUSTRATION_SIGNALS = {
  keywords: [
    'nao funciona', 'nao consigo', 'ta errado', 'nao da', 'impossivel',
    'complicado', 'dificil', 'confuso', 'perdi', 'sumiu', 'bugado',
    'travou', 'lento', 'demora', 'nao entendo', 'nao acho',
    'que raiva', 'irritante', 'horrivel', 'pessimo', 'ridiculo',
    'nao salva', 'nao carrega', 'erro', 'falha', 'quebrou',
    'cadê', 'onde fica', 'como faz', 'de novo', 'outra vez',
    'toda vez', 'sempre', 'nunca', 'deveria', 'podia', 'queria',
  ],
  patterns: [
    /(?:nao|n[aã]o)\s+(?:funciona|consigo|da|entendo|acho|salva|carrega)/i,
    /(?:ta|tá|está)\s+(?:errado|bugado|quebrado|lento|travado)/i,
    /(?:que|como|por\s*que)\s+(?:raiva|dificil|complicado)/i,
    /(?:perdi|sumiu|desapareceu)\s+(?:tudo|os?\s+dados?|o\s+que)/i,
    /(?:ja|já)\s+tentei\s+(?:varias|várias|mil)\s+vezes/i,
    /(?:deveria|podia|queria|gostaria)\s+(?:ter|de|que)/i,
  ],
};

/**
 * Analisa o sentimento de uma mensagem do usuario.
 * Retorna um score de -1 (muito negativo) a 1 (muito positivo).
 */
export function analyzeSentiment(message: string): {
  score: number;
  signals: string[];
  is_frustrated: boolean;
  suggested_action: 'none' | 'ask_feedback' | 'offer_help' | 'escalate';
} {
  const lowerMsg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const signals: string[] = [];
  let negativeScore = 0;

  // Check keywords
  for (const keyword of FRUSTRATION_SIGNALS.keywords) {
    if (lowerMsg.includes(keyword)) {
      signals.push(`keyword: "${keyword}"`);
      negativeScore += 1;
    }
  }

  // Check patterns
  for (const pattern of FRUSTRATION_SIGNALS.patterns) {
    if (pattern.test(message)) {
      signals.push(`pattern: ${pattern.source}`);
      negativeScore += 2;
    }
  }

  // Check repetition indicators (multiple question marks, exclamation marks)
  const exclamationCount = (message.match(/!/g) || []).length;
  const questionCount = (message.match(/\?/g) || []).length;
  if (exclamationCount >= 2) {
    signals.push('multiple_exclamations');
    negativeScore += 1;
  }
  if (questionCount >= 2) {
    signals.push('multiple_questions');
    negativeScore += 0.5;
  }

  // All caps detection
  const capsRatio = (message.match(/[A-Z]/g) || []).length / Math.max(message.length, 1);
  if (capsRatio > 0.5 && message.length > 5) {
    signals.push('caps_lock');
    negativeScore += 1;
  }

  const score = Math.max(-1, Math.min(1, 1 - negativeScore * 0.2));
  const is_frustrated = negativeScore >= 3;

  let suggested_action: 'none' | 'ask_feedback' | 'offer_help' | 'escalate' = 'none';
  if (negativeScore >= 6) {
    suggested_action = 'escalate';
  } else if (negativeScore >= 3) {
    suggested_action = 'ask_feedback';
  } else if (negativeScore >= 1) {
    suggested_action = 'offer_help';
  }

  return { score, signals, is_frustrated, suggested_action };
}

// ============================================================================
// FAQ OPERATIONS
// ============================================================================

function loadFAQBank(faqPath: string): FAQBank {
  if (!fs.existsSync(faqPath)) {
    return {
      metadata: {
        version: '1.0.0',
        description: 'Banco de FAQs do Orch',
        created_at: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString().split('T')[0],
        total_entries: 0,
        auto_generated: true,
      },
      categories: [],
      entries: [],
    };
  }
  const content = fs.readFileSync(faqPath, 'utf-8');
  const parsed = yaml.parse(content);
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    parsed.entries = [];
  }
  return parsed;
}

function saveFAQBank(faqPath: string, bank: FAQBank): void {
  bank.metadata.last_updated = new Date().toISOString().split('T')[0];
  bank.metadata.total_entries = bank.entries.length;
  fs.writeFileSync(faqPath, yaml.stringify(bank, { indent: 2 }));
}

/**
 * Adiciona ou atualiza uma FAQ no banco.
 * Se uma pergunta similar ja existe, incrementa a frequencia.
 */
export function addFAQ(
  faqPath: string,
  data: {
    question: string;
    answer: string;
    category: string;
    module: string;
    page_url: string;
    tags?: string[];
  }
): { action: 'created' | 'updated'; entry: FAQEntry } {
  const bank = loadFAQBank(faqPath);
  const now = new Date().toISOString();

  // Check for similar FAQ (simple string comparison)
  const existing = bank.entries.find(
    (e) =>
      e.question.toLowerCase() === data.question.toLowerCase() ||
      (e.module === data.module && e.page_url === data.page_url && similarity(e.question, data.question) > 0.7)
  );

  if (existing) {
    existing.frequency += 1;
    existing.last_asked = now;
    existing.asked_by_count += 1;
    saveFAQBank(faqPath, bank);
    return { action: 'updated', entry: existing };
  }

  const today = new Date().toISOString().split('T')[0];
  const dayCount = bank.entries.filter((e) => e.id.startsWith(`faq-${today}`)).length + 1;

  const entry: FAQEntry = {
    id: `faq-${today}-${String(dayCount).padStart(3, '0')}`,
    question: data.question,
    answer: data.answer,
    category: data.category,
    module: data.module,
    page_url: data.page_url,
    frequency: 1,
    first_asked: now,
    last_asked: now,
    asked_by_count: 1,
    status: 'active',
    tags: data.tags || [],
    related_faqs: [],
  };

  bank.entries.push(entry);
  saveFAQBank(faqPath, bank);
  return { action: 'created', entry };
}

// ============================================================================
// IMPROVEMENTS OPERATIONS
// ============================================================================

function loadImprovementsBank(impPath: string): ImprovementsBank {
  if (!fs.existsSync(impPath)) {
    return {
      metadata: {
        version: '1.0.0',
        description: 'Banco de melhorias do Orch',
        created_at: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString().split('T')[0],
        total_entries: 0,
        stats: { feature_requests: 0, adjustments: 0, bug_reports: 0, ux_issues: 0 },
      },
      entries: [],
    };
  }
  const content = fs.readFileSync(impPath, 'utf-8');
  const parsed = yaml.parse(content);
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    parsed.entries = [];
  }
  return parsed;
}

function saveImprovementsBank(impPath: string, bank: ImprovementsBank): void {
  bank.metadata.last_updated = new Date().toISOString().split('T')[0];
  bank.metadata.total_entries = bank.entries.length;
  bank.metadata.stats = {
    feature_requests: bank.entries.filter((e) => e.type === 'feature_request').length,
    adjustments: bank.entries.filter((e) => e.type === 'adjustment').length,
    bug_reports: bank.entries.filter((e) => e.type === 'bug_report').length,
    ux_issues: bank.entries.filter((e) => e.type === 'ux_issue').length,
  };
  fs.writeFileSync(impPath, yaml.stringify(bank, { indent: 2 }));
}

/**
 * Adiciona um improvement ao banco.
 */
export function addImprovement(
  impPath: string,
  data: {
    type: ImprovementEntry['type'];
    title: string;
    description: string;
    user_verbatim: string;
    module: string;
    page_url: string;
    priority?: ImprovementEntry['priority'];
    reported_by_role?: string;
    impact?: string;
    suggested_solution?: string;
    tags?: string[];
    sentiment?: string;
    trigger?: string;
    questions_asked?: number;
    // Bug-specific
    steps_to_reproduce?: string[];
    expected_behavior?: string;
    actual_behavior?: string;
    workaround?: string;
  }
): { action: 'created' | 'updated'; entry: ImprovementEntry } {
  const bank = loadImprovementsBank(impPath);
  const now = new Date().toISOString();

  // Check for similar improvement
  const existing = bank.entries.find(
    (e) =>
      e.type === data.type &&
      e.module === data.module &&
      similarity(e.title, data.title) > 0.7
  );

  if (existing) {
    existing.frequency += 1;
    existing.similar_reports.push(`Reported again at ${now}`);
    saveImprovementsBank(impPath, bank);
    return { action: 'updated', entry: existing };
  }

  const today = new Date().toISOString().split('T')[0];
  const dayCount = bank.entries.filter((e) => e.id.startsWith(`IMP-${today}`)).length + 1;

  const entry: ImprovementEntry = {
    id: `IMP-${today}-${String(dayCount).padStart(3, '0')}`,
    type: data.type,
    title: data.title,
    description: data.description,
    user_verbatim: data.user_verbatim,
    module: data.module,
    page_url: data.page_url,
    priority: data.priority || inferPriority(data.type, data.description),
    status: 'open',
    reported_at: now,
    reported_by_role: data.reported_by_role || 'unknown',
    frequency: 1,
    similar_reports: [],
    impact: data.impact || '',
    suggested_solution: data.suggested_solution || '',
    tags: data.tags || [],
    conversation_context: {
      sentiment: data.sentiment || 'neutral',
      trigger: data.trigger || 'user_reported',
      orch_questions_asked: data.questions_asked || 0,
    },
    // Bug-specific
    ...(data.type === 'bug_report' && {
      steps_to_reproduce: data.steps_to_reproduce || [],
      expected_behavior: data.expected_behavior || '',
      actual_behavior: data.actual_behavior || '',
      workaround: data.workaround || '',
    }),
  };

  bank.entries.push(entry);
  saveImprovementsBank(impPath, bank);
  return { action: 'created', entry };
}

// ============================================================================
// DAILY REPORT
// ============================================================================

/**
 * Gera relatorio diario consolidado com os feedbacks do dia.
 */
export function generateDailyReport(
  faqPath: string,
  impPath: string,
  reportsDir: string
): DailyReport {
  const faqBank = loadFAQBank(faqPath);
  const impBank = loadImprovementsBank(impPath);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Filter today's entries
  const todayFAQs = faqBank.entries.filter((e) => e.first_asked.startsWith(today));
  const todayImps = impBank.entries.filter((e) => e.reported_at.startsWith(today));

  // Count by type
  const byType: Record<string, number> = {};
  for (const imp of todayImps) {
    byType[imp.type] = (byType[imp.type] || 0) + 1;
  }

  // Top pages with issues
  const pageCounts: Record<string, number> = {};
  for (const imp of todayImps) {
    pageCounts[imp.page_url] = (pageCounts[imp.page_url] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([page, count]) => ({ page, count }));

  // Top improvements by frequency (all time)
  const topImprovements = impBank.entries
    .filter((e) => e.status === 'open')
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5)
    .map((e) => ({ title: e.title, frequency: e.frequency, type: e.type }));

  // New entries today
  const newEntries = [
    ...todayFAQs.map((e) => ({ id: e.id, type: 'faq', title: e.question })),
    ...todayImps.map((e) => ({ id: e.id, type: e.type, title: e.title })),
  ];

  const report: DailyReport = {
    date: today,
    generated_at: now,
    summary: {
      total_feedbacks: todayFAQs.length + todayImps.length,
      by_type: {
        faq: todayFAQs.length,
        ...byType,
      },
      new_faqs: todayFAQs.length,
      top_pages: topPages,
      top_improvements: topImprovements,
    },
    new_entries: newEntries,
  };

  // Save report file
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `${today}_feedback.yaml`);
  fs.writeFileSync(reportPath, yaml.stringify(report, { indent: 2 }));
  console.log(`Daily report saved to ${reportPath}`);

  return report;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcula similaridade simples entre duas strings (Jaccard de bigrams).
 */
function similarity(a: string, b: string): number {
  const getBigrams = (s: string): Set<string> => {
    const lower = s.toLowerCase();
    const bigrams = new Set<string>();
    for (let i = 0; i < lower.length - 1; i++) {
      bigrams.add(lower.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Infere prioridade baseada no tipo e descricao.
 */
function inferPriority(type: string, description: string): ImprovementEntry['priority'] {
  const lower = description.toLowerCase();

  if (type === 'bug_report') {
    if (lower.includes('perda de dados') || lower.includes('nao salva') || lower.includes('travou')) {
      return 'critical';
    }
    return 'high';
  }

  if (type === 'ux_issue') {
    if (lower.includes('impossivel') || lower.includes('nao consigo')) {
      return 'high';
    }
    return 'medium';
  }

  if (type === 'adjustment') {
    return 'medium';
  }

  return 'low';
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const actionArg = args.find((a) => a.startsWith('--action='));
  const dataArg = args.find((a) => a.startsWith('--data='));
  const basePath = args.find((a) => a.startsWith('--base-path='))?.split('=')[1] || './feedback';

  const action = actionArg?.split('=')[1];
  const data = dataArg ? JSON.parse(dataArg.split('=').slice(1).join('=')) : null;

  const faqPath = path.join(basePath, 'faq-bank.yaml');
  const impPath = path.join(basePath, 'improvements-bank.yaml');
  const reportsDir = path.join(basePath, 'reports');

  switch (action) {
    case 'add-faq': {
      if (!data) {
        console.error('Missing --data parameter');
        process.exit(1);
      }
      const result = addFAQ(faqPath, data);
      console.log(`FAQ ${result.action}: ${result.entry.id}`);
      break;
    }

    case 'add-improvement': {
      if (!data) {
        console.error('Missing --data parameter');
        process.exit(1);
      }
      const result = addImprovement(impPath, data);
      console.log(`Improvement ${result.action}: ${result.entry.id}`);
      break;
    }

    case 'analyze-sentiment': {
      if (!data?.message) {
        console.error('Missing --data=\'{"message":"..."}\'');
        process.exit(1);
      }
      const result = analyzeSentiment(data.message);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'daily-report': {
      const report = generateDailyReport(faqPath, impPath, reportsDir);
      console.log(JSON.stringify(report, null, 2));
      break;
    }

    case 'stats': {
      const faqBank = loadFAQBank(faqPath);
      const impBank = loadImprovementsBank(impPath);
      console.log('=== Orch Feedback Stats ===');
      console.log(`FAQs: ${faqBank.entries.length}`);
      console.log(`Improvements: ${impBank.entries.length}`);
      console.log(`  Feature Requests: ${impBank.entries.filter((e) => e.type === 'feature_request').length}`);
      console.log(`  Adjustments: ${impBank.entries.filter((e) => e.type === 'adjustment').length}`);
      console.log(`  Bug Reports: ${impBank.entries.filter((e) => e.type === 'bug_report').length}`);
      console.log(`  UX Issues: ${impBank.entries.filter((e) => e.type === 'ux_issue').length}`);
      console.log(`  Open: ${impBank.entries.filter((e) => e.status === 'open').length}`);
      break;
    }

    default:
      console.log('Usage:');
      console.log('  npx tsx orch-feedback.ts --action=add-faq --data=\'{"question":"...","answer":"...","category":"...","module":"...","page_url":"..."}\'');
      console.log('  npx tsx orch-feedback.ts --action=add-improvement --data=\'{"type":"bug_report","title":"...","description":"...","user_verbatim":"...","module":"...","page_url":"..."}\'');
      console.log('  npx tsx orch-feedback.ts --action=analyze-sentiment --data=\'{"message":"nao consigo salvar nada!!!"}\'');
      console.log('  npx tsx orch-feedback.ts --action=daily-report');
      console.log('  npx tsx orch-feedback.ts --action=stats');
      break;
  }
}

main().catch(console.error);
