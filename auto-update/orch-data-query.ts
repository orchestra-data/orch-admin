/**
 * Orch Data Query System
 *
 * Sistema de consulta de dados com verificacao de permissao,
 * insights inteligentes e correcao por feedback do usuario.
 *
 * Acesso hibrido: API (CRUD) + DB read-only (analytics)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TIPOS
// ============================================================

type EntityType = 'student' | 'class' | 'employee' | 'admission';

type InsightLevel = 'alta' | 'media' | 'baixa';

type InsightSeverity = 'info' | 'alerta' | 'critico';

interface PermissionCheck {
  userId: string;
  companyId: string;
  requiredPermission: string;
  granted: boolean;
  userRole?: string;
  checkedAt: string;
}

interface QueryContext {
  requesterId: string;         // ID do colaborador que perguntou
  requesterCompanyId: string;  // Empresa do colaborador
  targetEntityType: EntityType;
  targetEntityId?: string;
  targetEntityName?: string;
  question: string;            // Pergunta original do usuario
  pageUrl?: string;            // Pagina onde o usuario esta
}

interface DataInsight {
  id: string;
  title: string;
  description: string;
  confidence: InsightLevel;
  severity: InsightSeverity;
  dataPoints: number;
  recommendation?: string;
  correctedByUser?: boolean;
  correctionNote?: string;
}

interface QueryResult {
  success: boolean;
  permissionGranted: boolean;
  entityType: EntityType;
  entityId?: string;
  data?: Record<string, unknown>;
  insights: DataInsight[];
  responseText: string;
  corrections: CorrectionRecord[];
}

interface CorrectionRecord {
  id: string;
  insightId: string;
  originalConclusion: string;
  correctedConclusion: string;
  correctedBy: string;
  correctedAt: string;
  context: string;
}

// ============================================================
// MAPEAMENTO DE PERMISSOES POR ENTIDADE
// ============================================================

const PERMISSION_MAP: Record<EntityType, Record<string, string>> = {
  student: {
    view_profile: 'people.users.read',
    view_grades: 'class.grades.read',
    view_progress: 'class.enrollments.read',
    view_attendance: 'class.enrollments.read',
  },
  class: {
    view_class: 'class.instances.read',
    view_enrollments: 'class.enrollments.read',
    view_grades: 'class.grades.read',
  },
  employee: {
    view_profile: 'people.users.read',
    view_roles: 'people.users.read',
    view_permissions: 'platform.permissions.read',
  },
  admission: {
    view_process: 'admission.processes.read',
    view_candidates: 'admission.candidates.read',
  },
};

// Permissoes minimas para cada tipo de consulta
const MIN_PERMISSIONS: Record<EntityType, string[]> = {
  student: ['people.users.read'],
  class: ['class.instances.read'],
  employee: ['people.users.read'],
  admission: ['admission.candidates.read'],
};

// ============================================================
// VERIFICADOR DE PERMISSAO
// ============================================================

interface ApiClient {
  getUserEffectivePermissions(userId: string, companyId: string): Promise<{ permissions: string[] }>;
  getUser(userId: string, expand?: string[]): Promise<Record<string, unknown>>;
  listClassEnrollments(params: Record<string, unknown>): Promise<{ items: Record<string, unknown>[] }>;
  getClassInstance(classId: string, includeContent?: boolean): Promise<Record<string, unknown>>;
  getClassEnrollmentStats(classId: string): Promise<Record<string, unknown>>;
  getUserRoles(userId: string, companyId: string): Promise<{ roles: Record<string, unknown>[] }>;
  listUserCompanies(userId: string): Promise<{ companies: Record<string, unknown>[] }>;
}

interface DbReadOnly {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

class PermissionChecker {
  private cache: Map<string, { permissions: string[]; expiresAt: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private apiClient: ApiClient) {}

  /**
   * Verifica se o usuario tem permissao para acessar um tipo de dado
   */
  async checkPermission(
    userId: string,
    companyId: string,
    entityType: EntityType,
    specificPermission?: string
  ): Promise<PermissionCheck> {
    const userPermissions = await this.getUserPermissions(userId, companyId);

    const requiredPermissions = specificPermission
      ? [specificPermission]
      : MIN_PERMISSIONS[entityType];

    const hasPermission = requiredPermissions.some(req =>
      userPermissions.includes(req)
    );

    return {
      userId,
      companyId,
      requiredPermission: requiredPermissions.join(', '),
      granted: hasPermission,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Verifica TODAS as permissoes necessarias para uma consulta completa
   */
  async checkFullPermissions(
    userId: string,
    companyId: string,
    entityType: EntityType
  ): Promise<Record<string, boolean>> {
    const userPermissions = await this.getUserPermissions(userId, companyId);
    const entityPermissions = PERMISSION_MAP[entityType];
    const result: Record<string, boolean> = {};

    for (const [scope, permKey] of Object.entries(entityPermissions)) {
      result[scope] = userPermissions.includes(permKey);
    }

    return result;
  }

  private async getUserPermissions(userId: string, companyId: string): Promise<string[]> {
    const cacheKey = `${userId}:${companyId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const result = await this.apiClient.getUserEffectivePermissions(userId, companyId);

    this.cache.set(cacheKey, {
      permissions: result.permissions,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return result.permissions;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================
// MOTOR DE CONSULTA DE DADOS
// ============================================================

class DataQueryEngine {
  constructor(
    private apiClient: ApiClient,
    private db: DbReadOnly,
    private permissionChecker: PermissionChecker
  ) {}

  /**
   * Executa uma consulta de dados com verificacao de permissao
   */
  async executeQuery(context: QueryContext): Promise<QueryResult> {
    // 1. Verificar permissao
    const permCheck = await this.permissionChecker.checkPermission(
      context.requesterId,
      context.requesterCompanyId,
      context.targetEntityType
    );

    if (!permCheck.granted) {
      return {
        success: false,
        permissionGranted: false,
        entityType: context.targetEntityType,
        insights: [],
        responseText: this.formatPermissionDenied(context.targetEntityType, permCheck),
        corrections: [],
      };
    }

    // 2. Verificar permissoes granulares
    const fullPerms = await this.permissionChecker.checkFullPermissions(
      context.requesterId,
      context.requesterCompanyId,
      context.targetEntityType
    );

    // 3. Buscar dados conforme tipo
    let data: Record<string, unknown> = {};
    let insights: DataInsight[] = [];

    switch (context.targetEntityType) {
      case 'student':
        ({ data, insights } = await this.queryStudent(context, fullPerms));
        break;
      case 'class':
        ({ data, insights } = await this.queryClass(context, fullPerms));
        break;
      case 'employee':
        ({ data, insights } = await this.queryEmployee(context, fullPerms));
        break;
      case 'admission':
        ({ data, insights } = await this.queryAdmission(context, fullPerms));
        break;
    }

    return {
      success: true,
      permissionGranted: true,
      entityType: context.targetEntityType,
      entityId: context.targetEntityId,
      data,
      insights,
      responseText: this.formatResponse(context.targetEntityType, data, insights),
      corrections: [],
    };
  }

  // ----------------------------------------------------------
  // Consulta: Alunos e Notas
  // ----------------------------------------------------------
  private async queryStudent(
    context: QueryContext,
    perms: Record<string, boolean>
  ): Promise<{ data: Record<string, unknown>; insights: DataInsight[] }> {
    const data: Record<string, unknown> = {};
    const insights: DataInsight[] = [];

    // Perfil do aluno
    if (perms.view_profile && context.targetEntityId) {
      const user = await this.apiClient.getUser(context.targetEntityId, [
        'documents', 'studentProfiles',
      ]);
      data.profile = user;
    }

    // Matriculas e notas
    if (perms.view_grades && context.targetEntityId) {
      const enrollments = await this.apiClient.listClassEnrollments({
        userId: context.targetEntityId,
        includeClassDetails: true,
      });
      data.enrollments = enrollments.items;

      // Notas detalhadas via DB
      const grades = await this.db.query(
        `SELECT class_instance_id, grade_type, grade_value, weight,
                approval_status, graded_at
         FROM class_grades
         WHERE student_id = $1
         ORDER BY graded_at DESC
         LIMIT 50`,
        [context.targetEntityId]
      );
      data.grades = grades;

      // Gerar insight de tendencia de notas
      if (grades.length >= 3) {
        insights.push(this.analyzeGradeTrend(grades));
      }
    }

    // Progresso
    if (perms.view_progress && context.targetEntityId) {
      const progress = await this.db.query(
        `SELECT tracked_entity_type, completion_status, completion_percentage,
                score, attempts_count, time_spent_minutes,
                first_accessed_at, last_accessed_at
         FROM student_progress
         WHERE student_id = $1
         ORDER BY last_accessed_at DESC`,
        [context.targetEntityId]
      );
      data.progress = progress;

      // Insight de progresso estagnado
      if (progress.length > 0) {
        const stallInsight = this.analyzeProgressStall(progress);
        if (stallInsight) insights.push(stallInsight);
      }
    }

    // Frequencia
    if (perms.view_attendance && context.targetEntityId) {
      const attendance = await this.db.query(
        `SELECT session_type, attendance_source, is_present,
                duration_minutes, recorded_at
         FROM attendance_records
         WHERE student_id = $1
         ORDER BY recorded_at DESC
         LIMIT 100`,
        [context.targetEntityId]
      );
      data.attendance = attendance;

      // Insight de frequencia
      if (attendance.length >= 5) {
        insights.push(this.analyzeAttendancePattern(attendance));
      }
    }

    return { data, insights };
  }

  // ----------------------------------------------------------
  // Consulta: Turmas
  // ----------------------------------------------------------
  private async queryClass(
    context: QueryContext,
    perms: Record<string, boolean>
  ): Promise<{ data: Record<string, unknown>; insights: DataInsight[] }> {
    const data: Record<string, unknown> = {};
    const insights: DataInsight[] = [];

    if (perms.view_class && context.targetEntityId) {
      // Dados da turma
      const classInstance = await this.apiClient.getClassInstance(
        context.targetEntityId, true
      );
      data.classInstance = classInstance;

      // Estatisticas
      if (perms.view_enrollments) {
        const stats = await this.apiClient.getClassEnrollmentStats(
          context.targetEntityId
        );
        data.stats = stats;

        // Lista de matriculas
        const enrollments = await this.apiClient.listClassEnrollments({
          classInstanceId: context.targetEntityId,
          includeUserDetails: true,
        });
        data.enrollments = enrollments.items;
      }

      // Notas da turma via DB
      if (perms.view_grades) {
        const gradesOverview = await this.db.query(
          `SELECT
            COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN approval_status = 'at_risk' THEN 1 END) as at_risk_count,
            COUNT(CASE WHEN approval_status = 'failed' THEN 1 END) as failed_count,
            COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_count,
            AVG(grade_value) as average_grade,
            MAX(grade_value) as highest_grade,
            MIN(grade_value) as lowest_grade
           FROM class_grades
           WHERE class_instance_id = $1`,
          [context.targetEntityId]
        );
        data.gradesOverview = gradesOverview[0];

        // Insight de saude da turma
        const ci = classInstance as Record<string, unknown>;
        insights.push(this.analyzeClassHealth(
          data.stats as Record<string, unknown>,
          gradesOverview[0],
          ci
        ));

        // Insight de distribuicao de notas
        if (gradesOverview[0]) {
          const distInsight = this.analyzeGradeDistribution(gradesOverview[0]);
          if (distInsight) insights.push(distInsight);
        }
      }
    }

    return { data, insights };
  }

  // ----------------------------------------------------------
  // Consulta: Funcionarios
  // ----------------------------------------------------------
  private async queryEmployee(
    context: QueryContext,
    perms: Record<string, boolean>
  ): Promise<{ data: Record<string, unknown>; insights: DataInsight[] }> {
    const data: Record<string, unknown> = {};
    const insights: DataInsight[] = [];

    if (perms.view_profile && context.targetEntityId) {
      const user = await this.apiClient.getUser(context.targetEntityId, [
        'documents', 'employeeProfiles',
      ]);
      data.profile = user;

      // Empresas do funcionario
      const companies = await this.apiClient.listUserCompanies(
        context.targetEntityId
      );
      data.companies = companies.companies;

      // Insight multi-empresa
      if (companies.companies.length > 1) {
        insights.push({
          id: 'multi_company_access',
          title: 'Acesso multi-empresa',
          description: `Este funcionario tem acesso a ${companies.companies.length} empresas/unidades.`,
          confidence: 'alta',
          severity: 'info',
          dataPoints: companies.companies.length,
        });
      }
    }

    if (perms.view_roles && context.targetEntityId) {
      const roles = await this.apiClient.getUserRoles(
        context.targetEntityId,
        context.requesterCompanyId
      );
      data.roles = roles.roles;
    }

    if (perms.view_permissions && context.targetEntityId) {
      const permResult = await this.permissionChecker.checkFullPermissions(
        context.targetEntityId,
        context.requesterCompanyId,
        'student' // verificar acesso a dados de alunos
      );
      data.effectivePermissions = permResult;
    }

    return { data, insights };
  }

  // ----------------------------------------------------------
  // Consulta: Processos Seletivos
  // ----------------------------------------------------------
  private async queryAdmission(
    context: QueryContext,
    perms: Record<string, boolean>
  ): Promise<{ data: Record<string, unknown>; insights: DataInsight[] }> {
    const data: Record<string, unknown> = {};
    const insights: DataInsight[] = [];

    if (perms.view_candidates && context.targetEntityId) {
      // Candidatos do processo
      const candidates = await this.db.query(
        `SELECT candidate_id, pipeline_stage, evaluation_score,
                payment_status, completion_percentage, created_at, updated_at
         FROM admission_candidates
         WHERE admission_id = $1
         ORDER BY created_at DESC`,
        [context.targetEntityId]
      );
      data.candidates = candidates;

      // Pipeline overview
      const pipelineStats = await this.db.query(
        `SELECT pipeline_stage,
                COUNT(*) as count,
                AVG(evaluation_score) as avg_score,
                AVG(completion_percentage) as avg_completion
         FROM admission_candidates
         WHERE admission_id = $1
         GROUP BY pipeline_stage`,
        [context.targetEntityId]
      );
      data.pipelineStats = pipelineStats;

      // Pagamentos
      const paymentStats = await this.db.query(
        `SELECT payment_status, COUNT(*) as count
         FROM admission_candidates
         WHERE admission_id = $1
         GROUP BY payment_status`,
        [context.targetEntityId]
      );
      data.paymentStats = paymentStats;

      // Insights
      if (pipelineStats.length > 0) {
        const bottleneck = this.analyzePipelineBottleneck(pipelineStats);
        if (bottleneck) insights.push(bottleneck);
      }

      if (paymentStats.length > 0) {
        const paymentHealth = this.analyzePaymentHealth(paymentStats, candidates.length);
        if (paymentHealth) insights.push(paymentHealth);
      }

      if (candidates.length >= 5) {
        insights.push(this.analyzeConversionRate(candidates));
      }
    }

    return { data, insights };
  }

  // ============================================================
  // MOTOR DE INSIGHTS
  // ============================================================

  private analyzeGradeTrend(grades: Record<string, unknown>[]): DataInsight {
    const values = grades
      .filter(g => g.grade_value != null)
      .map(g => g.grade_value as number);

    if (values.length < 3) {
      return {
        id: 'grade_trend',
        title: 'Tendencia de notas',
        description: 'Dados insuficientes para analise de tendencia.',
        confidence: 'baixa',
        severity: 'info',
        dataPoints: values.length,
      };
    }

    const recent = values.slice(0, 3);
    const older = values.slice(3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0
      ? older.reduce((a, b) => a + b, 0) / older.length
      : recentAvg;

    const diff = recentAvg - olderAvg;
    const consecutiveLow = recent.filter(v => v < 60).length;

    let description: string;
    let severity: InsightSeverity = 'info';
    let recommendation: string | undefined;

    if (consecutiveLow >= 3) {
      description = `As ultimas ${consecutiveLow} notas estao abaixo de 60. Media recente: ${recentAvg.toFixed(1)}.`;
      severity = 'critico';
      recommendation = 'Recomendo intervencao pedagogica. Verificar se ha dificuldade em conteudo especifico.';
    } else if (diff < -20) {
      description = `Queda significativa de desempenho: media caiu de ${olderAvg.toFixed(1)} para ${recentAvg.toFixed(1)} (${diff.toFixed(1)} pontos).`;
      severity = 'alerta';
      recommendation = 'Acompanhar de perto nas proximas avaliacoes.';
    } else if (diff < -5) {
      description = `Leve tendencia de queda: media recente ${recentAvg.toFixed(1)} vs anterior ${olderAvg.toFixed(1)}.`;
      severity = 'alerta';
    } else if (diff > 10) {
      description = `Tendencia positiva: notas subindo de ${olderAvg.toFixed(1)} para ${recentAvg.toFixed(1)}.`;
      severity = 'info';
    } else {
      description = `Notas estaveis com media de ${recentAvg.toFixed(1)}.`;
      severity = 'info';
    }

    return {
      id: 'grade_trend',
      title: 'Tendencia de notas',
      description,
      confidence: values.length >= 5 ? 'alta' : 'media',
      severity,
      dataPoints: values.length,
      recommendation,
    };
  }

  private analyzeProgressStall(progress: Record<string, unknown>[]): DataInsight | null {
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

    const stalled = progress.filter(p => {
      const lastAccess = new Date(p.last_accessed_at as string).getTime();
      const completion = p.completion_percentage as number;
      return (now - lastAccess > twoWeeksMs) && completion < 100;
    });

    const struggling = progress.filter(p => {
      const attempts = p.attempts_count as number;
      const score = p.score as number;
      return attempts > 5 && score < 60;
    });

    if (stalled.length === 0 && struggling.length === 0) return null;

    const parts: string[] = [];
    if (stalled.length > 0) {
      parts.push(`${stalled.length} conteudo(s) sem acesso ha mais de 2 semanas`);
    }
    if (struggling.length > 0) {
      parts.push(`${struggling.length} conteudo(s) com muitas tentativas e nota baixa`);
    }

    return {
      id: 'progress_stall',
      title: 'Progresso estagnado',
      description: parts.join('. ') + '.',
      confidence: 'alta',
      severity: stalled.length > 2 || struggling.length > 0 ? 'alerta' : 'info',
      dataPoints: progress.length,
      recommendation: stalled.length > 2
        ? 'Aluno pode estar com dificuldade ou desmotivado. Considere uma abordagem individual.'
        : undefined,
    };
  }

  private analyzeAttendancePattern(attendance: Record<string, unknown>[]): DataInsight {
    const total = attendance.length;
    const present = attendance.filter(a => a.is_present === true).length;
    const rate = (present / total) * 100;

    const consecutive_absences = this.countConsecutiveAbsences(attendance);

    let severity: InsightSeverity = 'info';
    let recommendation: string | undefined;

    if (rate < 75) {
      severity = 'critico';
      recommendation = 'Frequencia abaixo do minimo exigido (75%). Entrar em contato com o aluno.';
    } else if (consecutive_absences >= 3) {
      severity = 'alerta';
      recommendation = `${consecutive_absences} faltas consecutivas detectadas. Verificar situacao do aluno.`;
    } else if (rate < 85) {
      severity = 'alerta';
    }

    // Frequencia por tipo de sessao
    const byType: Record<string, { total: number; present: number }> = {};
    for (const a of attendance) {
      const type = (a.session_type as string) || 'outro';
      if (!byType[type]) byType[type] = { total: 0, present: 0 };
      byType[type].total++;
      if (a.is_present) byType[type].present++;
    }

    const typeDetails = Object.entries(byType)
      .map(([type, stats]) => `${type}: ${((stats.present / stats.total) * 100).toFixed(0)}%`)
      .join(', ');

    return {
      id: 'attendance_pattern',
      title: 'Padrao de frequencia',
      description: `Frequencia geral: ${rate.toFixed(1)}% (${present}/${total}). Por tipo: ${typeDetails}.`,
      confidence: total >= 10 ? 'alta' : 'media',
      severity,
      dataPoints: total,
      recommendation,
    };
  }

  private analyzeClassHealth(
    stats: Record<string, unknown>,
    gradesOverview: Record<string, unknown>,
    classInstance: Record<string, unknown>
  ): DataInsight {
    const completionRate = (stats.completion_rate as number) || 0;
    const avgGrade = (gradesOverview.average_grade as number) || 0;
    const engagementScore = (classInstance.engagement_score as number) || 50;
    const churnRate = (classInstance.churn_rate as number) || 0;

    // Score ponderado
    const healthScore =
      completionRate * 0.3 +
      avgGrade * 0.25 +
      engagementScore * 0.25 +
      (100 - churnRate * 100) * 0.2;

    let severity: InsightSeverity;
    let label: string;
    if (healthScore > 80) {
      severity = 'info';
      label = 'Saudavel';
    } else if (healthScore > 60) {
      severity = 'alerta';
      label = 'Atencao';
    } else {
      severity = 'critico';
      label = 'Critico';
    }

    return {
      id: 'class_health',
      title: `Saude da turma: ${label}`,
      description: `Score: ${healthScore.toFixed(0)}/100. Conclusao: ${completionRate.toFixed(0)}%, Media: ${avgGrade.toFixed(1)}, Engajamento: ${engagementScore.toFixed(0)}%, Evasao: ${(churnRate * 100).toFixed(1)}%.`,
      confidence: 'alta',
      severity,
      dataPoints: (stats.total_enrolled as number) || 0,
      recommendation: healthScore < 60
        ? 'Turma em situacao critica. Recomendo reuniao com coordenacao para plano de acao.'
        : undefined,
    };
  }

  private analyzeGradeDistribution(overview: Record<string, unknown>): DataInsight | null {
    const atRisk = (overview.at_risk_count as number) || 0;
    const failed = (overview.failed_count as number) || 0;
    const approved = (overview.approved_count as number) || 0;
    const pending = (overview.pending_count as number) || 0;
    const total = atRisk + failed + approved + pending;

    if (total === 0) return null;

    const atRiskPct = (atRisk / total) * 100;
    const failedPct = (failed / total) * 100;

    let severity: InsightSeverity = 'info';
    let recommendation: string | undefined;

    if (atRiskPct > 30) {
      severity = 'alerta';
      recommendation = `${atRiskPct.toFixed(0)}% dos alunos em risco. Considere reforco ou revisao de conteudo.`;
    }
    if (failedPct > 15) {
      severity = 'critico';
      recommendation = `${failedPct.toFixed(0)}% de reprovacao. Revisar metodologia e avaliacoes.`;
    }

    return {
      id: 'grade_distribution',
      title: 'Distribuicao de notas',
      description: `Aprovados: ${approved} (${((approved/total)*100).toFixed(0)}%), Em risco: ${atRisk} (${atRiskPct.toFixed(0)}%), Reprovados: ${failed} (${failedPct.toFixed(0)}%), Pendentes: ${pending}.`,
      confidence: 'alta',
      severity,
      dataPoints: total,
      recommendation,
    };
  }

  private analyzePipelineBottleneck(stats: Record<string, unknown>[]): DataInsight | null {
    if (stats.length < 2) return null;

    const sorted = [...stats].sort(
      (a, b) => (b.count as number) - (a.count as number)
    );
    const biggest = sorted[0];

    const total = stats.reduce((sum, s) => sum + (s.count as number), 0);
    const biggestPct = ((biggest.count as number) / total) * 100;

    if (biggestPct < 40) return null;

    return {
      id: 'pipeline_bottleneck',
      title: 'Gargalo no pipeline',
      description: `${biggestPct.toFixed(0)}% dos candidatos estao no estagio "${biggest.pipeline_stage}". Pode indicar um gargalo.`,
      confidence: total >= 10 ? 'alta' : 'media',
      severity: biggestPct > 60 ? 'alerta' : 'info',
      dataPoints: total,
      recommendation: `Verificar por que tantos candidatos estao parados em "${biggest.pipeline_stage}".`,
    };
  }

  private analyzePaymentHealth(
    paymentStats: Record<string, unknown>[],
    totalCandidates: number
  ): DataInsight | null {
    const overdue = paymentStats.find(p => p.payment_status === 'overdue');
    const overdueCount = overdue ? (overdue.count as number) : 0;
    const overduePct = totalCandidates > 0 ? (overdueCount / totalCandidates) * 100 : 0;

    if (overdueCount === 0) return null;

    return {
      id: 'payment_health',
      title: 'Saude de pagamentos',
      description: `${overdueCount} candidato(s) com pagamento atrasado (${overduePct.toFixed(0)}% do total).`,
      confidence: 'alta',
      severity: overduePct > 20 ? 'alerta' : 'info',
      dataPoints: totalCandidates,
      recommendation: overduePct > 20
        ? 'Alto indice de inadimplencia. Considere acoes de cobranca ou facilitacao de pagamento.'
        : undefined,
    };
  }

  private analyzeConversionRate(candidates: Record<string, unknown>[]): DataInsight {
    const total = candidates.length;
    const completed = candidates.filter(c =>
      (c.completion_percentage as number) >= 100
    ).length;
    const rate = (completed / total) * 100;

    return {
      id: 'conversion_rate',
      title: 'Taxa de conversao',
      description: `${completed} de ${total} candidatos completaram o processo (${rate.toFixed(1)}%).`,
      confidence: total >= 10 ? 'alta' : 'media',
      severity: rate < 50 ? 'alerta' : 'info',
      dataPoints: total,
      recommendation: rate < 50
        ? 'Taxa de conversao baixa. Verificar complexidade do processo de inscricao.'
        : undefined,
    };
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  private countConsecutiveAbsences(attendance: Record<string, unknown>[]): number {
    let max = 0;
    let current = 0;
    for (const a of attendance) {
      if (!a.is_present) {
        current++;
        if (current > max) max = current;
      } else {
        current = 0;
      }
    }
    return max;
  }

  // ============================================================
  // FORMATACAO DE RESPOSTAS
  // ============================================================

  private formatPermissionDenied(entityType: EntityType, check: PermissionCheck): string {
    const entityNames: Record<EntityType, string> = {
      student: 'dados de alunos',
      class: 'dados de turmas',
      employee: 'dados de funcionarios',
      admission: 'dados de processos seletivos',
    };

    return [
      `Desculpe, voce nao tem permissao para acessar ${entityNames[entityType]}.`,
      '',
      `Permissao necessaria: **${check.requiredPermission}**`,
      '',
      'Se voce acredita que deveria ter esse acesso, fale com seu gestor ou administrador do sistema.',
    ].join('\n');
  }

  private formatResponse(
    entityType: EntityType,
    data: Record<string, unknown>,
    insights: DataInsight[]
  ): string {
    const parts: string[] = [];

    // Dados principais formatados por tipo
    parts.push(this.formatEntityData(entityType, data));

    // Insights
    if (insights.length > 0) {
      parts.push('');
      parts.push('---');
      parts.push('');

      for (const insight of insights) {
        const icon = insight.severity === 'critico' ? '[!]'
          : insight.severity === 'alerta' ? '[*]'
          : '[i]';

        const confidence = insight.confidence === 'alta'
          ? 'Com base nos dados'
          : insight.confidence === 'media'
          ? 'Pelos padroes que observo'
          : 'Posso estar errado, mas parece que';

        parts.push(`**${icon} ${insight.title}**`);
        parts.push(`${confidence}: ${insight.description}`);
        if (insight.recommendation) {
          parts.push(`Recomendacao: ${insight.recommendation}`);
        }
        parts.push('');
      }

      parts.push('_Nota: Essas sao analises automaticas. Se algo nao bater com a realidade, me corrija!_');
    }

    return parts.join('\n');
  }

  private formatEntityData(entityType: EntityType, data: Record<string, unknown>): string {
    // Formatacao basica - o LLM do Orch vai formatar melhor
    // baseado na pergunta do usuario
    const lines: string[] = [];

    switch (entityType) {
      case 'student': {
        const profile = data.profile as Record<string, unknown>;
        if (profile) {
          lines.push(`**Aluno:** ${profile.full_name || profile.fullName}`);
          lines.push(`**Status:** ${profile.status}`);
          lines.push(`**Email:** ${profile.email}`);
        }
        const enrollments = data.enrollments as Record<string, unknown>[];
        if (enrollments?.length > 0) {
          lines.push('');
          lines.push(`**Matriculas:** ${enrollments.length} turma(s)`);
          for (const e of enrollments.slice(0, 5)) {
            const grade = e.final_grade != null ? ` | Nota: ${e.final_grade}` : '';
            lines.push(`- ${e.class_instance_name || e.classInstanceName} (${e.enrollment_status || e.enrollmentStatus})${grade}`);
          }
          if (enrollments.length > 5) {
            lines.push(`  ... e mais ${enrollments.length - 5} turma(s)`);
          }
        }
        break;
      }

      case 'class': {
        const ci = data.classInstance as Record<string, unknown>;
        if (ci) {
          lines.push(`**Turma:** ${ci.name}`);
          lines.push(`**Codigo:** ${ci.code}`);
          lines.push(`**Modalidade:** ${ci.delivery_mode || ci.deliveryMode}`);
          lines.push(`**Status:** ${ci.status}`);
          lines.push(`**Alunos matriculados:** ${ci.enrolled_students_count || ci.enrolledStudentsCount}`);
        }
        const stats = data.stats as Record<string, unknown>;
        if (stats) {
          lines.push('');
          lines.push('**Estatisticas:**');
          lines.push(`- Matriculados: ${stats.total_enrolled || stats.totalEnrolled}`);
          lines.push(`- Concluiram: ${stats.total_completed || stats.totalCompleted}`);
          lines.push(`- Desistiram: ${stats.total_dropped || stats.totalDropped}`);
          lines.push(`- Media geral: ${(stats.average_grade as number || stats.averageGrade as number || 0).toFixed(1)}`);
          lines.push(`- Taxa de conclusao: ${(stats.completion_rate as number || stats.completionRate as number || 0).toFixed(1)}%`);
        }
        break;
      }

      case 'employee': {
        const profile = data.profile as Record<string, unknown>;
        if (profile) {
          lines.push(`**Funcionario:** ${profile.full_name || profile.fullName}`);
          lines.push(`**Email:** ${profile.email}`);
          lines.push(`**Status:** ${profile.status}`);
          lines.push(`**Tipo:** ${profile.user_type || profile.userType}`);
        }
        const roles = data.roles as Record<string, unknown>[];
        if (roles?.length > 0) {
          lines.push('');
          lines.push('**Roles:**');
          for (const r of roles) {
            lines.push(`- ${r.role_name || r.roleName} (${r.role_slug || r.roleSlug})`);
          }
        }
        const companies = data.companies as Record<string, unknown>[];
        if (companies?.length > 0) {
          lines.push('');
          lines.push(`**Empresas:** ${companies.length}`);
          for (const c of companies) {
            lines.push(`- ${c.company_name || c.companyName}`);
          }
        }
        break;
      }

      case 'admission': {
        const stats = data.pipelineStats as Record<string, unknown>[];
        if (stats?.length > 0) {
          lines.push('**Pipeline do Processo Seletivo:**');
          for (const s of stats) {
            lines.push(`- ${s.pipeline_stage}: ${s.count} candidato(s) (media score: ${(s.avg_score as number || 0).toFixed(1)})`);
          }
        }
        const payments = data.paymentStats as Record<string, unknown>[];
        if (payments?.length > 0) {
          lines.push('');
          lines.push('**Pagamentos:**');
          for (const p of payments) {
            lines.push(`- ${p.payment_status}: ${p.count}`);
          }
        }
        break;
      }
    }

    return lines.join('\n');
  }
}

// ============================================================
// GERENCIADOR DE CORRECOES
// ============================================================

class CorrectionManager {
  private correctionsFile: string;
  private corrections: CorrectionRecord[] = [];

  constructor(baseDir: string) {
    this.correctionsFile = path.join(baseDir, 'feedback', 'insight-corrections.yaml');
    this.loadCorrections();
  }

  /**
   * Registra uma correcao feita pelo usuario
   */
  addCorrection(
    insightId: string,
    original: string,
    corrected: string,
    userId: string,
    context: string
  ): CorrectionRecord {
    const record: CorrectionRecord = {
      id: `corr_${Date.now()}`,
      insightId,
      originalConclusion: original,
      correctedConclusion: corrected,
      correctedBy: userId,
      correctedAt: new Date().toISOString(),
      context,
    };

    this.corrections.push(record);
    this.saveCorrections();
    return record;
  }

  /**
   * Busca correcoes anteriores para um tipo de insight
   */
  getCorrectionsForInsight(insightId: string): CorrectionRecord[] {
    return this.corrections.filter(c => c.insightId === insightId);
  }

  /**
   * Verifica se um insight similar ja foi corrigido antes
   */
  hasBeenCorrected(insightId: string, context: string): CorrectionRecord | undefined {
    return this.corrections.find(
      c => c.insightId === insightId && c.context === context
    );
  }

  private loadCorrections(): void {
    try {
      if (fs.existsSync(this.correctionsFile)) {
        const content = fs.readFileSync(this.correctionsFile, 'utf-8');
        // Parse YAML manually (simple format)
        const lines = content.split('\n');
        let current: Partial<CorrectionRecord> | null = null;

        for (const line of lines) {
          if (line.startsWith('- id:')) {
            if (current) this.corrections.push(current as CorrectionRecord);
            current = { id: line.split(': ')[1]?.trim() };
          } else if (current && line.includes(':')) {
            const [key, ...vals] = line.trim().split(': ');
            const cleanKey = key.replace('- ', '').trim();
            const value = vals.join(': ').trim().replace(/^["']|["']$/g, '');
            (current as Record<string, string>)[this.toCamelCase(cleanKey)] = value;
          }
        }
        if (current) this.corrections.push(current as CorrectionRecord);
      }
    } catch {
      this.corrections = [];
    }
  }

  private saveCorrections(): void {
    const dir = path.dirname(this.correctionsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const yaml = this.corrections.map(c => [
      `- id: ${c.id}`,
      `  insight_id: ${c.insightId}`,
      `  original_conclusion: "${c.originalConclusion}"`,
      `  corrected_conclusion: "${c.correctedConclusion}"`,
      `  corrected_by: ${c.correctedBy}`,
      `  corrected_at: ${c.correctedAt}`,
      `  context: "${c.context}"`,
    ].join('\n')).join('\n\n');

    fs.writeFileSync(
      this.correctionsFile,
      `# Correcoes de insights feitas por usuarios\n# Auto-gerado pelo Orch Data Query System\n\ncorrections:\n${yaml}\n`
    );
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
}

// ============================================================
// CLASSIFICADOR DE INTENCAO DE CONSULTA
// ============================================================

interface QueryIntent {
  entityType: EntityType;
  entityIdentifier?: string;     // nome ou ID
  dataScope: string[];           // quais dados quer ver
  isSpecificEntity: boolean;     // consulta sobre entidade especifica vs geral
  keywords: string[];
}

const ENTITY_KEYWORDS: Record<EntityType, string[]> = {
  student: [
    'aluno', 'aluna', 'estudante', 'nota', 'notas', 'boletim',
    'frequencia', 'presenca', 'falta', 'faltas', 'progresso',
    'desempenho', 'media', 'aprovado', 'reprovado', 'matricula',
  ],
  class: [
    'turma', 'turmas', 'classe', 'disciplina', 'materia',
    'matriculas', 'engajamento', 'evasao', 'conclusao',
  ],
  employee: [
    'funcionario', 'funcionaria', 'colaborador', 'colaboradora',
    'professor', 'professora', 'coordenador', 'permissao',
    'permissoes', 'cargo', 'role', 'acesso',
  ],
  admission: [
    'processo seletivo', 'candidato', 'candidata', 'inscricao',
    'vestibular', 'admissao', 'pipeline', 'pagamento',
    'candidatos', 'selecao', 'oferta',
  ],
};

function classifyQueryIntent(question: string): QueryIntent {
  const lower = question.toLowerCase();
  const scores: Record<EntityType, number> = {
    student: 0,
    class: 0,
    employee: 0,
    admission: 0,
  };

  const matchedKeywords: string[] = [];

  for (const [entity, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[entity as EntityType]++;
        matchedKeywords.push(kw);
      }
    }
  }

  // Determinar tipo com maior score
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const entityType = (sorted[0][1] > 0 ? sorted[0][0] : 'student') as EntityType;

  // Determinar escopo de dados
  const dataScope: string[] = [];
  if (lower.includes('nota') || lower.includes('media') || lower.includes('boletim')) {
    dataScope.push('grades');
  }
  if (lower.includes('frequencia') || lower.includes('presenca') || lower.includes('falta')) {
    dataScope.push('attendance');
  }
  if (lower.includes('progresso') || lower.includes('andamento')) {
    dataScope.push('progress');
  }
  if (lower.includes('permiss') || lower.includes('acesso') || lower.includes('role')) {
    dataScope.push('permissions');
  }
  if (lower.includes('pagamento') || lower.includes('financ')) {
    dataScope.push('payment');
  }
  if (dataScope.length === 0) dataScope.push('all');

  return {
    entityType,
    dataScope,
    isSpecificEntity: matchedKeywords.length > 0,
    keywords: matchedKeywords,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  PermissionChecker,
  DataQueryEngine,
  CorrectionManager,
  classifyQueryIntent,
  QueryContext,
  QueryResult,
  DataInsight,
  QueryIntent,
  EntityType,
  InsightLevel,
  InsightSeverity,
  PermissionCheck,
  CorrectionRecord,
  PERMISSION_MAP,
  MIN_PERMISSIONS,
  ENTITY_KEYWORDS,
};
