/**
 * ORCH Admin - Dify Knowledge Base Setup
 *
 * This script uploads all YAML files from the knowledge-base folder
 * to a Dify dataset for RAG retrieval.
 *
 * Usage:
 *   npx ts-node setup-knowledge-base.ts
 *
 * Prerequisites:
 *   1. Dify running at http://localhost:3001
 *   2. Create an account and get API key from Settings > API Keys
 *   3. Set DIFY_API_KEY environment variable
 */

import * as fs from 'fs';
import * as path from 'path';

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'http://localhost:3001';
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', 'knowledge-base');

interface DifyDataset {
  id: string;
  name: string;
}

interface DifyDocument {
  id: string;
  name: string;
  indexing_status: string;
}

async function main() {
  if (!DIFY_API_KEY) {
    console.error('❌ DIFY_API_KEY environment variable not set');
    console.log('\nTo get your API key:');
    console.log('1. Open http://localhost:3001');
    console.log('2. Create account / Login');
    console.log('3. Go to Settings > API Keys');
    console.log('4. Create new API key');
    console.log('5. Run: DIFY_API_KEY=your-key npx ts-node setup-knowledge-base.ts');
    process.exit(1);
  }

  console.log('🚀 ORCH Admin - Dify Knowledge Base Setup\n');

  // Step 1: Create or get dataset
  console.log('📁 Creating dataset "ORCH Admin Knowledge Base"...');
  const dataset = await createOrGetDataset('ORCH Admin Knowledge Base');
  console.log(`   Dataset ID: ${dataset.id}\n`);

  // Step 2: List YAML files
  const yamlFiles = fs.readdirSync(KNOWLEDGE_BASE_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => path.join(KNOWLEDGE_BASE_DIR, f));

  console.log(`📄 Found ${yamlFiles.length} YAML files to upload:\n`);

  // Step 3: Upload each file
  for (const filePath of yamlFiles) {
    const fileName = path.basename(filePath);
    console.log(`   ⬆️  Uploading ${fileName}...`);

    try {
      const doc = await uploadDocument(dataset.id, filePath);
      console.log(`   ✅ ${fileName} (${doc.id})`);
    } catch (err) {
      console.error(`   ❌ Failed to upload ${fileName}:`, err);
    }
  }

  console.log('\n✅ Knowledge base setup complete!');
  console.log('\nNext steps:');
  console.log('1. Open Dify console: http://localhost:3001');
  console.log('2. Go to "Knowledge" and verify documents are indexed');
  console.log('3. Create a new "Chat App" and attach the knowledge base');
  console.log('4. Get the App API key and set DIFY_ORCH_ADMIN_API_KEY in Cogedu');
}

async function createOrGetDataset(name: string): Promise<DifyDataset> {
  // List existing datasets
  const listRes = await fetch(`${DIFY_BASE_URL}/v1/datasets?page=1&limit=100`, {
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
    },
  });

  if (!listRes.ok) {
    throw new Error(`Failed to list datasets: ${await listRes.text()}`);
  }

  const listData = await listRes.json() as { data: DifyDataset[] };
  const existing = listData.data.find(d => d.name === name);

  if (existing) {
    console.log(`   Found existing dataset: ${existing.id}`);
    return existing;
  }

  // Create new dataset
  const createRes = await fetch(`${DIFY_BASE_URL}/v1/datasets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description: 'ORCH Admin contextual knowledge base for Cogedu system guidance',
      indexing_technique: 'high_quality',
      permission: 'only_me',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create dataset: ${await createRes.text()}`);
  }

  return await createRes.json() as DifyDataset;
}

async function uploadDocument(datasetId: string, filePath: string): Promise<DifyDocument> {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);

  // Create form data
  const formData = new FormData();
  formData.append('file', new Blob([fileContent]), fileName);
  formData.append('data', JSON.stringify({
    indexing_technique: 'high_quality',
    process_rule: {
      mode: 'automatic',
    },
  }));

  const res = await fetch(
    `${DIFY_BASE_URL}/v1/datasets/${datasetId}/document/create_by_file`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    throw new Error(`Upload failed: ${await res.text()}`);
  }

  const data = await res.json() as { document: DifyDocument };
  return data.document;
}

main().catch(console.error);
