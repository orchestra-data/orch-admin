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
 * v2.0 - AST-BASED PARSING
 * Usa ts-morph para parsing real do TypeScript/JSX.
 * Detecta: rotas em variaveis, spread operators, lazy imports, nested routes.
 *
 * Uso: npx tsx orch-scanner.ts --cogedu-path ../cogedu --output ./knowledge-base/cogedu-pages-guide.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  Project,
  SyntaxKind,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  JsxElement,
  JsxSelfClosingElement,
  JsxAttribute,
  SourceFile,
  ArrayLiteralExpression,
  CallExpression,
  SpreadElement,
  VariableDeclaration,
} from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

interface ScannedRoute {
  path: string;
  componentName: string;
  filePath: string;
  parentLayout?: string;
  isLazy: boolean;
  isDynamic: boolean;
  children?: ScannedRoute[];
}

interface ScannedField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
  source: 'jsx' | 'rhf' | 'zod';
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
// AST PROJECT SETUP
// ============================================================================

let project: Project;

function initProject(cogeduPath: string): void {
  const tsConfigPath = path.join(cogeduPath, 'apps/web/tsconfig.json');

  if (fs.existsSync(tsConfigPath)) {
    project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  } else {
    project = new Project({
      compilerOptions: {
        jsx: 4, // JsxEmit.ReactJSX
        target: 99, // ScriptTarget.ESNext
        module: 99, // ModuleKind.ESNext
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    });
  }
}

// ============================================================================
// AST-BASED ROUTER SCANNER
// ============================================================================

function scanRouterFile(cogeduPath: string): ScannedRoute[] {
  const routerPath = path.join(cogeduPath, 'apps/web/src/router.tsx');

  if (!fs.existsSync(routerPath)) {
    console.error(`Router file not found: ${routerPath}`);
    return [];
  }

  initProject(cogeduPath);
  const sourceFile = project.addSourceFileAtPath(routerPath);
  const routes: ScannedRoute[] = [];
  const routeVariables = new Map<string, ScannedRoute[]>();

  // First pass: collect route arrays stored in variables
  collectRouteVariables(sourceFile, routeVariables);

  // Second pass: find createBrowserRouter or RouterProvider usage
  const routerCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of routerCalls) {
    const callName = call.getExpression().getText();

    if (callName === 'createBrowserRouter' || callName === 'createHashRouter') {
      const args = call.getArguments();
      if (args.length > 0) {
        const routesArg = args[0];
        extractRoutesFromNode(routesArg, routes, routeVariables);
      }
    }
  }

  // Also look for direct array exports or route definitions
  if (routes.length === 0) {
    const arrays = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
    for (const arr of arrays) {
      if (containsRouteObjects(arr)) {
        extractRoutesFromArray(arr, routes, routeVariables);
      }
    }
  }

  // Flatten nested routes for easier processing
  const flatRoutes = flattenRoutes(routes);

  console.log(`Found ${flatRoutes.length} routes in router.tsx (AST-based)`);
  return flatRoutes;
}

function collectRouteVariables(sourceFile: SourceFile, routeVariables: Map<string, ScannedRoute[]>): void {
  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

  for (const varDecl of variableDeclarations) {
    const initializer = varDecl.getInitializer();
    if (initializer && Node.isArrayLiteralExpression(initializer)) {
      if (containsRouteObjects(initializer)) {
        const routes: ScannedRoute[] = [];
        extractRoutesFromArray(initializer, routes, routeVariables);
        routeVariables.set(varDecl.getName(), routes);
      }
    }
  }
}

function containsRouteObjects(arr: ArrayLiteralExpression): boolean {
  const elements = arr.getElements();
  return elements.some(el => {
    if (Node.isObjectLiteralExpression(el)) {
      return el.getProperty('path') !== undefined || el.getProperty('element') !== undefined;
    }
    return false;
  });
}

function extractRoutesFromNode(
  node: Node,
  routes: ScannedRoute[],
  routeVariables: Map<string, ScannedRoute[]>
): void {
  if (Node.isArrayLiteralExpression(node)) {
    extractRoutesFromArray(node, routes, routeVariables);
  } else if (Node.isIdentifier(node)) {
    // Reference to a variable containing routes
    const varName = node.getText();
    const varRoutes = routeVariables.get(varName);
    if (varRoutes) {
      routes.push(...varRoutes);
    }
  } else if (Node.isSpreadElement(node)) {
    // Spread operator: ...someRoutes
    const expression = node.getExpression();
    if (Node.isIdentifier(expression)) {
      const varName = expression.getText();
      const varRoutes = routeVariables.get(varName);
      if (varRoutes) {
        routes.push(...varRoutes);
      }
    }
  }
}

function extractRoutesFromArray(
  arr: ArrayLiteralExpression,
  routes: ScannedRoute[],
  routeVariables: Map<string, ScannedRoute[]>
): void {
  const elements = arr.getElements();

  for (const element of elements) {
    if (Node.isObjectLiteralExpression(element)) {
      const route = extractRouteFromObject(element, routeVariables);
      if (route) {
        routes.push(route);
      }
    } else if (Node.isSpreadElement(element)) {
      // Handle spread: ...otherRoutes
      const expression = element.getExpression();
      if (Node.isIdentifier(expression)) {
        const varName = expression.getText();
        const varRoutes = routeVariables.get(varName);
        if (varRoutes) {
          routes.push(...varRoutes);
        }
      }
    }
  }
}

function extractRouteFromObject(
  obj: ObjectLiteralExpression,
  routeVariables: Map<string, ScannedRoute[]>
): ScannedRoute | null {
  let routePath = '';
  let componentName = '';
  let isLazy = false;
  let children: ScannedRoute[] = [];

  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const propName = prop.getName();
    const initializer = prop.getInitializer();
    if (!initializer) continue;

    switch (propName) {
      case 'path':
        routePath = extractStringValue(initializer);
        break;

      case 'element':
        componentName = extractComponentName(initializer);
        break;

      case 'Component':
        componentName = initializer.getText();
        break;

      case 'lazy':
        isLazy = true;
        componentName = extractLazyComponentName(initializer);
        break;

      case 'children':
        if (Node.isArrayLiteralExpression(initializer)) {
          extractRoutesFromArray(initializer, children, routeVariables);
        } else if (Node.isIdentifier(initializer)) {
          const varRoutes = routeVariables.get(initializer.getText());
          if (varRoutes) {
            children.push(...varRoutes);
          }
        }
        break;
    }
  }

  // Skip index routes without path or component
  if (!routePath && !componentName) {
    return null;
  }

  return {
    path: routePath,
    componentName: componentName || 'Unknown',
    filePath: `routes/${componentName}`,
    isLazy,
    isDynamic: routePath.includes(':') || routePath.includes('*'),
    children: children.length > 0 ? children : undefined,
  };
}

function extractStringValue(node: Node): string {
  if (Node.isStringLiteral(node)) {
    return node.getLiteralText();
  }
  if (Node.isTemplateExpression(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    // Template literal - extract what we can
    return node.getText().replace(/`/g, '').replace(/\$\{[^}]+\}/g, ':param');
  }
  return node.getText().replace(/['"]/g, '');
}

function extractComponentName(node: Node): string {
  if (Node.isJsxElement(node)) {
    const openingElement = node.getOpeningElement();
    return openingElement.getTagNameNode().getText();
  }
  if (Node.isJsxSelfClosingElement(node)) {
    return node.getTagNameNode().getText();
  }
  if (Node.isJsxFragment(node)) {
    return 'Fragment';
  }
  // Fallback: try to extract from text
  const text = node.getText();
  const match = text.match(/<(\w+)/);
  return match ? match[1] : text;
}

function extractLazyComponentName(node: Node): string {
  // Pattern: () => import("./routes/ComponentName")
  const text = node.getText();
  const match = text.match(/import\(["'`]\.\/routes\/([^"'`]+)["'`]\)/);
  if (match) {
    return match[1].replace(/\/index$/, '');
  }
  // Pattern: () => import("./ComponentName")
  const simpleMatch = text.match(/import\(["'`]\.\/([^"'`]+)["'`]\)/);
  if (simpleMatch) {
    return simpleMatch[1].replace(/\/index$/, '');
  }
  return 'LazyComponent';
}

function flattenRoutes(routes: ScannedRoute[], parentPath = ''): ScannedRoute[] {
  const flat: ScannedRoute[] = [];

  for (const route of routes) {
    const fullPath = combinePaths(parentPath, route.path);

    flat.push({
      ...route,
      path: fullPath,
    });

    if (route.children) {
      flat.push(...flattenRoutes(route.children, fullPath));
    }
  }

  return flat;
}

function combinePaths(parent: string, child: string): string {
  if (!child) return parent;
  if (child.startsWith('/')) return child;
  if (!parent) return child.startsWith('/') ? child : `/${child}`;
  return `${parent}/${child}`.replace(/\/+/g, '/');
}

// ============================================================================
// AST-BASED COMPONENT SCANNER
// ============================================================================

function scanComponentForFields(filePath: string): ScannedField[] {
  if (!fs.existsSync(filePath)) return [];

  const sourceFile = project.addSourceFileAtPath(filePath);
  const fields: ScannedField[] = [];
  const seenNames = new Set<string>();

  // 1. Scan JSX elements (input, select, textarea)
  scanJsxFields(sourceFile, fields, seenNames);

  // 2. Scan React Hook Form usage
  scanReactHookFormFields(sourceFile, fields, seenNames);

  // 3. Scan Zod schemas
  scanZodSchemaFields(sourceFile, fields, seenNames);

  return fields;
}

function scanJsxFields(sourceFile: SourceFile, fields: ScannedField[], seenNames: Set<string>): void {
  const jsxElements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ];

  for (const element of jsxElements) {
    const tagName = element.getTagNameNode().getText().toLowerCase();

    if (!['input', 'select', 'textarea'].includes(tagName)) continue;

    const nameAttr = getJsxAttribute(element, 'name');
    if (!nameAttr || seenNames.has(nameAttr)) continue;

    seenNames.add(nameAttr);

    fields.push({
      name: nameAttr,
      label: getJsxAttribute(element, 'label') ||
             getJsxAttribute(element, 'placeholder') ||
             getJsxAttribute(element, 'aria-label') ||
             nameAttr,
      type: tagName === 'select' ? 'select' :
            tagName === 'textarea' ? 'textarea' :
            getJsxAttribute(element, 'type') || 'text',
      required: hasJsxAttribute(element, 'required') ||
                getJsxAttribute(element, 'aria-required') === 'true',
      placeholder: getJsxAttribute(element, 'placeholder'),
      source: 'jsx',
    });
  }
}

function scanReactHookFormFields(sourceFile: SourceFile, fields: ScannedField[], seenNames: Set<string>): void {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const callName = call.getExpression().getText();

    if (callName === 'register' || callName === 'setValue' || callName === 'control.register') {
      const args = call.getArguments();
      if (args.length > 0) {
        const fieldName = extractStringValue(args[0]);
        if (fieldName && !seenNames.has(fieldName)) {
          seenNames.add(fieldName);
          fields.push({
            name: fieldName,
            label: fieldName,
            type: 'text',
            required: false,
            source: 'rhf',
          });
        }
      }
    }
  }
}

function scanZodSchemaFields(sourceFile: SourceFile, fields: ScannedField[], seenNames: Set<string>): void {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  // Find z.object({...}) calls
  for (const call of callExpressions) {
    const callText = call.getExpression().getText();

    if (callText === 'z.object') {
      const args = call.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        extractZodFieldsFromObject(args[0] as ObjectLiteralExpression, fields, seenNames);
      }
    }
  }
}

function extractZodFieldsFromObject(
  obj: ObjectLiteralExpression,
  fields: ScannedField[],
  seenNames: Set<string>
): void {
  const zodTypeMap: Record<string, string> = {
    'string': 'text',
    'number': 'number',
    'boolean': 'checkbox',
    'enum': 'select',
    'date': 'date',
    'array': 'multi_select',
    'nativeEnum': 'select',
  };

  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const fieldName = prop.getName();
    if (seenNames.has(fieldName)) continue;

    const initializer = prop.getInitializer();
    if (!initializer) continue;

    const initText = initializer.getText();
    let fieldType = 'text';
    let required = true;

    // Detect Zod type
    for (const [zodType, htmlType] of Object.entries(zodTypeMap)) {
      if (initText.includes(`z.${zodType}(`)) {
        fieldType = htmlType;
        break;
      }
    }

    // Check if optional
    if (initText.includes('.optional()') || initText.includes('.nullable()')) {
      required = false;
    }

    seenNames.add(fieldName);
    fields.push({
      name: fieldName,
      label: fieldName,
      type: fieldType,
      required,
      source: 'zod',
    });
  }
}

function getJsxAttribute(element: Node, attrName: string): string | undefined {
  const attributes = element.getDescendantsOfKind(SyntaxKind.JsxAttribute);

  for (const attr of attributes) {
    if (attr.getName() === attrName) {
      const initializer = attr.getInitializer();
      if (!initializer) return 'true'; // Boolean attribute

      if (Node.isStringLiteral(initializer)) {
        return initializer.getLiteralText();
      }
      if (Node.isJsxExpression(initializer)) {
        const expr = initializer.getExpression();
        if (expr && Node.isStringLiteral(expr)) {
          return expr.getLiteralText();
        }
      }
    }
  }
  return undefined;
}

function hasJsxAttribute(element: Node, attrName: string): boolean {
  const attributes = element.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  return attributes.some(attr => attr.getName() === attrName);
}

// ============================================================================
// AST-BASED MODAL SCANNER
// ============================================================================

function scanComponentForModals(filePath: string): ScannedModal[] {
  if (!fs.existsSync(filePath)) return [];

  const sourceFile = project.addSourceFileAtPath(filePath);
  const modals: ScannedModal[] = [];
  const modalTags = ['Dialog', 'AlertDialog', 'Sheet', 'Modal', 'Drawer'];

  const jsxElements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  let modalCount = 0;

  for (const element of jsxElements) {
    let tagName: string;

    if (Node.isJsxElement(element)) {
      tagName = element.getOpeningElement().getTagNameNode().getText();
    } else {
      tagName = (element as JsxSelfClosingElement).getTagNameNode().getText();
    }

    // Check if it's a modal component (including prefixed like RadixDialog.Root)
    const isModal = modalTags.some(modal =>
      tagName === modal ||
      tagName.endsWith(`.${modal}`) ||
      tagName.endsWith(`${modal}.Root`)
    );

    if (!isModal) continue;

    modalCount++;
    let title = `Modal ${modalCount}`;

    // Try to find title inside the modal
    if (Node.isJsxElement(element)) {
      const titleElement = element.getDescendantsOfKind(SyntaxKind.JsxElement)
        .find(el => {
          const tag = el.getOpeningElement().getTagNameNode().getText();
          return tag.includes('Title') || tag.includes('Header');
        });

      if (titleElement) {
        const textContent = titleElement.getJsxChildren()
          .filter(child => Node.isJsxText(child))
          .map(child => child.getText().trim())
          .join(' ');
        if (textContent) {
          title = textContent;
        }
      }
    }

    modals.push({
      name: title,
      trigger: 'button_click',
      fields: [], // Would need deeper analysis to extract modal fields
    });
  }

  return modals;
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
  for (const [pagePath] of existingPages) {
    if (!scannedPaths.has(pagePath)) {
      result.removedPaths.push(pagePath);
    }
  }

  return result;
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('# Orch Scanner Report (AST-based v2.0)');
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
        lines.push(`  - ${field.name} (${field.type}) [${field.source}] ${field.required ? '*' : ''}`);
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
    appendContent.push(`# AUTO-DISCOVERED PAGES (${new Date().toISOString().split('T')[0]}) - AST Scan v2.0`);
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
      appendContent.push(`    scan_version: "2.0-ast"`);

      if (page.fields.length > 0) {
        appendContent.push(`    fields:`);
        for (const field of page.fields) {
          appendContent.push(`      - name: "${field.name}"`);
          appendContent.push(`        label: "${field.label}"`);
          appendContent.push(`        type: "${field.type}"`);
          appendContent.push(`        required: ${field.required}`);
          appendContent.push(`        source: "${field.source}"`);
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
    .replace(/[{}:*]/g, '')
    .replace(/-/g, '_')
    .replace(/_+/g, '_');
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

  console.log('=== Orch Scanner v2.0 (AST-based) ===');
  console.log(`Cogedu path: ${cogeduPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // 1. Scan routes using AST
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
      path.join(srcPath, `pages/${route.componentName}.tsx`),
      path.join(srcPath, `pages/${route.componentName}/index.tsx`),
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
      description: `Page: ${route.componentName}${route.isLazy ? ' (lazy loaded)' : ''}${route.isDynamic ? ' (dynamic)' : ''}`,
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
  const reportDir = path.resolve(path.dirname(outputPath));
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, 'scan-report.md');
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
