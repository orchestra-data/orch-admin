/**
 * Orch Scanner - Auto-update Knowledge Base
 *
 * Escaneia o codebase do Cogedu e extrai:
 * - Rotas do router.tsx
 * - Campos de formulario (inputs, selects, textareas)
 * - Modais e dialogs
 * - Botoes de acao
 *
 * Compara com o YAML atual e gera diff com novas paginas/campos.
 *
 * LIMITACOES CONHECIDAS:
 * - Usa REGEX (nao AST real) para extrair rotas do router.tsx
 * - NAO detecta: rotas em variaveis, template literals, spread operators
 * - NAO detecta: rotas definidas em arquivos importados (re-exports)
 * - Se o router.tsx mudar de estrutura, os regex precisam ser ajustados
 * - Para AST real no futuro, considerar migrar para @swc/core ou ts-morph
 *
 * Uso: npx tsx orch-scanner.ts --cogedu-path ../cogedu --output ./knowledge-base/cogedu-pages-guide.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// ============================================================================
// TYPES
// ============================================================================

interface ScannedRoute {
  path: string;
  componentName: string;
  filePath: string;
  parentLayout?: string;
}

interface ScannedField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
}

interface ScannedModal {
  name: string;
  trigger: string;
  fields: ScannedField[];
}

interface ScannedPage {
  url_pattern: string;
  page_name: string;
  description: string;
  fields: ScannedField[];
  modals: ScannedModal[];
  actions: string[];
  lastScanned: string;
}

interface ScanResult {
  newPages: ScannedPage[];
  updatedPages: ScannedPage[];
  removedPaths: string[];
  unchangedCount: number;
}

// ============================================================================
// ROUTER SCANNER
// ============================================================================

function scanRouterFile(cogeduPath: string): ScannedRoute[] {
  const routerPath = path.join(cogeduPath, 'apps/web/src/router.tsx');

  if (!fs.existsSync(routerPath)) {
    console.error(`Router file not found: ${routerPath}`);
    return [];
  }

  const content = fs.readFileSync(routerPath, 'utf-8');
  const routes: ScannedRoute[] = [];

  // Match route definitions: { path: "...", element: <Component /> }
  // or { path: "...", Component: ComponentName }
  const routePatterns = [
    // Pattern: path: "xxx", element: <Xxx />
    /path:\s*["']([^"']+)["'][\s\S]*?element:\s*<(\w+)/g,
    // Pattern: path: "xxx", Component: Xxx
    /path:\s*["']([^"']+)["'][\s\S]*?Component:\s*(\w+)/g,
    // Pattern: { path: "xxx", lazy: () => import("./routes/Xxx") }
    /path:\s*["']([^"']+)["'][\s\S]*?lazy:\s*\(\)\s*=>\s*import\(["']\.\/routes\/([^"']+)["']\)/g,
  ];

  for (const pattern of routePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      routes.push({
        path: match[1],
        componentName: match[2],
        filePath: `routes/${match[2]}`,
      });
    }
  }

  console.log(`Found ${routes.length} routes in router.tsx`);
  return routes;
}

// ============================================================================
// COMPONENT SCANNER
// ============================================================================

function scanComponentForFields(filePath: string): ScannedField[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const fields: ScannedField[] = [];

  // Pattern 1: <input name="xxx" ... />
  const inputPattern = /<(?:input|Input)\s+[^>]*name=["'](\w+)["'][^>]*/g;
  let match;
  while ((match = inputPattern.exec(content)) !== null) {
    const fullTag = match[0];
    fields.push({
      name: match[1],
      label: extractAttr(fullTag, 'label') || extractAttr(fullTag, 'placeholder') || match[1],
      type: extractAttr(fullTag, 'type') || 'text',
      required: fullTag.includes('required'),
      placeholder: extractAttr(fullTag, 'placeholder'),
    });
  }

  // Pattern 2: <Select name="xxx" ... />
  const selectPattern = /<(?:select|Select)\s+[^>]*name=["'](\w+)["'][^>]*/g;
  while ((match = selectPattern.exec(content)) !== null) {
    fields.push({
      name: match[1],
      label: extractAttr(match[0], 'label') || match[1],
      type: 'select',
      required: match[0].includes('required'),
    });
  }

  // Pattern 3: <Textarea name="xxx" ... />
  const textareaPattern = /<(?:textarea|Textarea)\s+[^>]*name=["'](\w+)["'][^>]*/g;
  while ((match = textareaPattern.exec(content)) !== null) {
    fields.push({
      name: match[1],
      label: extractAttr(match[0], 'label') || match[1],
      type: 'textarea',
      required: match[0].includes('required'),
      placeholder: extractAttr(match[0], 'placeholder'),
    });
  }

  // Pattern 4: register("fieldName") or setValue("fieldName") (React Hook Form)
  const rhfPattern = /(?:register|setValue)\(["'](\w+)["']/g;
  while ((match = rhfPattern.exec(content)) !== null) {
    if (!fields.find(f => f.name === match[1])) {
      fields.push({
        name: match[1],
        label: match[1],
        type: 'text',
        required: false,
      });
    }
  }

  // Pattern 5: Zod schema fields - z.string(), z.number(), etc.
  const zodPattern = /(\w+):\s*z\.(string|number|boolean|enum|date|array)\(/g;
  while ((match = zodPattern.exec(content)) !== null) {
    if (!fields.find(f => f.name === match[1])) {
      const zodTypeMap: Record<string, string> = {
        string: 'text',
        number: 'number',
        boolean: 'checkbox',
        enum: 'select',
        date: 'date',
        array: 'multi_select',
      };
      fields.push({
        name: match[1],
        label: match[1],
        type: zodTypeMap[match[2]] || 'text',
        required: !content.includes(`${match[1]}: z.${match[2]}().optional`),
      });
    }
  }

  return fields;
}

function scanComponentForModals(filePath: string): ScannedModal[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const modals: ScannedModal[] = [];

  // Pattern: <Dialog or <AlertDialog or <Sheet
  const modalPattern = /<(?:Dialog|AlertDialog|Sheet)\b/g;
  let match;
  let modalCount = 0;

  while ((match = modalPattern.exec(content)) !== null) {
    modalCount++;
    // Extract title if available
    const titleMatch = content.slice(match.index, match.index + 500).match(/(?:Title|title)>([^<]+)</);
    modals.push({
      name: titleMatch ? titleMatch[1].trim() : `Modal ${modalCount}`,
      trigger: 'button_click',
      fields: [], // Fields inside modals would need deeper parsing
    });
  }

  return modals;
}

function extractAttr(tag: string, attr: string): string | undefined {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`));
  return match ? match[1] : undefined;
}

// ============================================================================
// YAML COMPARATOR
// ============================================================================

function loadExistingKnowledgeBase(yamlPath: string): Map<string, any> {
  const existing = new Map<string, any>();

  if (!fs.existsSync(yamlPath)) return existing;

  const content = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = yaml.parse(content);

  // Extract all url_patterns from all modules
  function extractPages(obj: any, prefix = '') {
    if (!obj || typeof obj !== 'object') return;

    if (obj.url_pattern) {
      existing.set(obj.url_pattern, obj);
    }

    if (obj.pages) {
      for (const page of Object.values(obj.pages) as any[]) {
        extractPages(page, prefix);
      }
    }

    for (const key of Object.keys(obj)) {
      if (key.endsWith('_module') || key === 'pages') {
        extractPages(obj[key], key);
      }
    }
  }

  extractPages(parsed);
  return existing;
}

function compareAndGenerateDiff(
  scannedPages: ScannedPage[],
  existingPages: Map<string, any>
): ScanResult {
  const result: ScanResult = {
    newPages: [],
    updatedPages: [],
    removedPaths: [],
    unchangedCount: 0,
  };

  const scannedPaths = new Set<string>();

  for (const page of scannedPages) {
    scannedPaths.add(page.url_pattern);
    const existing = existingPages.get(page.url_pattern);

    if (!existing) {
      result.newPages.push(page);
    } else {
      // Check if fields changed
      const existingFieldCount = existing.fields?.length || 0;
      if (page.fields.length !== existingFieldCount) {
        result.updatedPages.push(page);
      } else {
        result.unchangedCount++;
      }
    }
  }

  // Check for removed pages
  for (const [path] of existingPages) {
    if (!scannedPaths.has(path)) {
      result.removedPaths.push(path);
    }
  }

  return result;
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('# Orch Scanner Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`- New pages: ${result.newPages.length}`);
  lines.push(`- Updated pages: ${result.updatedPages.length}`);
  lines.push(`- Removed pages: ${result.removedPaths.length}`);
  lines.push(`- Unchanged: ${result.unchangedCount}`);
  lines.push('');

  if (result.newPages.length > 0) {
    lines.push('## New Pages');
    for (const page of result.newPages) {
      lines.push(`### ${page.url_pattern}`);
      lines.push(`- Component: ${page.page_name}`);
      lines.push(`- Fields: ${page.fields.length}`);
      lines.push(`- Modals: ${page.modals.length}`);
      for (const field of page.fields) {
        lines.push(`  - ${field.name} (${field.type}) ${field.required ? '*' : ''}`);
      }
      lines.push('');
    }
  }

  if (result.updatedPages.length > 0) {
    lines.push('## Updated Pages');
    for (const page of result.updatedPages) {
      lines.push(`- ${page.url_pattern} (${page.fields.length} fields)`);
    }
    lines.push('');
  }

  if (result.removedPaths.length > 0) {
    lines.push('## Removed Pages');
    for (const p of result.removedPaths) {
      lines.push(`- ${p}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// YAML UPDATER
// ============================================================================

function appendNewPagesToYaml(
  yamlPath: string,
  newPages: ScannedPage[],
  updatedPages: ScannedPage[]
): void {
  if (newPages.length === 0 && updatedPages.length === 0) {
    console.log('No changes to write.');
    return;
  }

  // Append new pages as a new section
  const appendContent: string[] = [];

  if (newPages.length > 0) {
    appendContent.push('');
    appendContent.push('# ============================================================================');
    appendContent.push(`# AUTO-DISCOVERED PAGES (${new Date().toISOString().split('T')[0]})`);
    appendContent.push('# Status: PENDING REVIEW - Validate fields and descriptions');
    appendContent.push('# ============================================================================');

    for (const page of newPages) {
      appendContent.push(`  ${sanitizeKey(page.url_pattern)}:`);
      appendContent.push(`    url_pattern: "${page.url_pattern}"`);
      appendContent.push(`    page_name: "${page.page_name}"`);
      appendContent.push(`    description: "${page.description}"`);
      appendContent.push(`    auto_discovered: true`);
      appendContent.push(`    discovered_at: "${new Date().toISOString()}"`);
      appendContent.push(`    status: "pending_review"`);

      if (page.fields.length > 0) {
        appendContent.push(`    fields:`);
        for (const field of page.fields) {
          appendContent.push(`      - name: "${field.name}"`);
          appendContent.push(`        label: "${field.label}"`);
          appendContent.push(`        type: "${field.type}"`);
          appendContent.push(`        required: ${field.required}`);
          if (field.placeholder) {
            appendContent.push(`        placeholder: "${field.placeholder}"`);
          }
        }
      }

      if (page.modals.length > 0) {
        appendContent.push(`    modals:`);
        for (const modal of page.modals) {
          appendContent.push(`      - name: "${modal.name}"`);
          appendContent.push(`        trigger: "${modal.trigger}"`);
        }
      }

      appendContent.push('');
    }
  }

  fs.appendFileSync(yamlPath, appendContent.join('\n'));
  console.log(`Appended ${newPages.length} new pages to ${yamlPath}`);
}

function sanitizeKey(urlPattern: string): string {
  return urlPattern
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[{}:]/g, '')
    .replace(/-/g, '_');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const cogeduPathArg = args.find(a => a.startsWith('--cogedu-path='));
  const outputArg = args.find(a => a.startsWith('--output='));
  const dryRun = args.includes('--dry-run');

  const cogeduPath = cogeduPathArg?.split('=')[1] || '../cogedu';
  const outputPath = outputArg?.split('=')[1] || './knowledge-base/cogedu-pages-guide.yaml';

  console.log('=== Orch Scanner ===');
  console.log(`Cogedu path: ${cogeduPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // 1. Scan routes
  const routes = scanRouterFile(cogeduPath);

  // 2. Scan each route component for fields
  const scannedPages: ScannedPage[] = [];
  const srcPath = path.join(cogeduPath, 'apps/web/src');

  for (const route of routes) {
    // Try to find the component file
    const possiblePaths = [
      path.join(srcPath, `${route.filePath}.tsx`),
      path.join(srcPath, `${route.filePath}/index.tsx`),
      path.join(srcPath, `${route.filePath}Route.tsx`),
      path.join(srcPath, `routes/${route.componentName}.tsx`),
      path.join(srcPath, `routes/${route.componentName}/index.tsx`),
    ];

    let componentFile = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        componentFile = p;
        break;
      }
    }

    const fields = componentFile ? scanComponentForFields(componentFile) : [];
    const modals = componentFile ? scanComponentForModals(componentFile) : [];

    scannedPages.push({
      url_pattern: route.path.startsWith('/') ? route.path : `/${route.path}`,
      page_name: route.componentName,
      description: `Page: ${route.componentName}`,
      fields,
      modals,
      actions: [],
      lastScanned: new Date().toISOString(),
    });
  }

  console.log(`Scanned ${scannedPages.length} pages`);

  // 3. Load existing knowledge base
  const existingPages = loadExistingKnowledgeBase(outputPath);
  console.log(`Existing pages in KB: ${existingPages.size}`);

  // 4. Compare
  const result = compareAndGenerateDiff(scannedPages, existingPages);

  // 5. Generate report
  const report = generateReport(result);
  console.log('');
  console.log(report);

  // 6. Write report
  const reportPath = path.join(path.dirname(outputPath), 'scan-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to ${reportPath}`);

  // 7. Update YAML (if not dry run)
  if (!dryRun && (result.newPages.length > 0 || result.updatedPages.length > 0)) {
    appendNewPagesToYaml(outputPath, result.newPages, result.updatedPages);
    console.log('Knowledge base updated!');
  } else if (dryRun) {
    console.log('Dry run - no changes written.');
  } else {
    console.log('No changes detected.');
  }
}

main().catch(console.error);
