import fs from 'fs';
import path from 'path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let ajv: Ajv | null = null;
let validateManifestFn: Ajv.ValidateFunction | null = null;

/**
 * Compile and cache Ajv validators.
 * Pass schemaPath if your schema is not in ./schemas/dlm1-manifest.schema.json
 */
export function initValidators(schemaPath?: string) {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  }

  if (!validateManifestFn) {
    const manifestSchemaFile =
      schemaPath || path.resolve(process.cwd(), 'schemas/dlm1-manifest.schema.json');
    const raw = fs.readFileSync(manifestSchemaFile, 'utf8');
    const schema = JSON.parse(raw);
    validateManifestFn = ajv!.compile(schema);
  }
}

export function validateDlm1Manifest(manifest: unknown): {
  ok: boolean;
  errors?: any;
} {
  if (!ajv || !validateManifestFn) initValidators();
  const ok = validateManifestFn!(manifest);
  if (!ok) {
    return {
      ok: false,
      errors: validateManifestFn!.errors,
    };
  }
  return { ok: true };
}
