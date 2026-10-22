import { readFile } from 'node:fs/promises';
import { MAX_BYTES, validateContent } from '../src/data/validate.ts';

try {
  const raw = await readFile(new URL('../public/content.json', import.meta.url));
  if (raw.length > MAX_BYTES) throw new Error('CONTENT_INVALID');
  const result = validateContent(JSON.parse(raw.toString('utf8')), Date.now(), { allowLocalPreview: true, allowPublicPreview: true });
  if (!result.ok || result.value.issues.length) {
    console.error(`${!result.ok ? result.error.code : 'CONTENT_INVALID'}: inspect public/content.json; see docs/development.md. For expired fictional data only: npm run demo:refresh.`);
    process.exitCode = 1;
  } else console.log(`Content OK: schema ${result.value.schema}, revision ${result.value.revision}; ${raw.length} bytes; 3 modes validated.`);
} catch { console.error('CONTENT_INVALID: public/content.json is missing, malformed or too large. See docs/development.md.'); process.exitCode = 1; }
