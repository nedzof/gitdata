import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let ajv: Ajv | null = null;
let validateReceiptFn: Ajv.ValidateFunction | null = null;

export function initReceiptValidator(schemaPath?: string) {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  }
  if (!validateReceiptFn) {
    const p = schemaPath || path.resolve(process.cwd(), 'schemas/receipt.schema.json');
    const schema = JSON.parse(fs.readFileSync(p, 'utf8'));
    validateReceiptFn = ajv!.compile(schema);
  }
}

export function validateReceipt(doc: unknown): { ok: boolean; errors?: any } {
  if (!ajv || !validateReceiptFn) initReceiptValidator();
  const ok = validateReceiptFn!(doc);
  if (!ok) return { ok: false, errors: validateReceiptFn!.errors };
  return { ok: true };
}