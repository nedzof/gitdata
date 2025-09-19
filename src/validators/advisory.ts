import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let ajv: Ajv | null = null;
let validateAdvFn: Ajv.ValidateFunction | null = null;

export function initAdvisoryValidator(schemaPath?: string) {
  if (!ajv) { ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv); }
  if (!validateAdvFn) {
    const p = schemaPath || path.resolve(process.cwd(), 'schemas/advisory.schema.json');
    const schema = JSON.parse(fs.readFileSync(p, 'utf8'));
    validateAdvFn = ajv!.compile(schema);
  }
}
export function validateAdvisory(doc: unknown): { ok: boolean; errors?: any } {
  if (!ajv || !validateAdvFn) initAdvisoryValidator();
  const ok = validateAdvFn!(doc);
  if (!ok) return { ok: false, errors: validateAdvFn!.errors };
  return { ok: true };
}