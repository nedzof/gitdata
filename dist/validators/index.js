"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initValidators = initValidators;
exports.validateDlm1Manifest = validateDlm1Manifest;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
let ajv = null;
let validateManifestFn = null;
/**
 * Compile and cache Ajv validators.
 * Pass schemaPath if your schema is not in ./schemas/dlm1-manifest.schema.json
 */
function initValidators(schemaPath) {
    if (!ajv) {
        ajv = new ajv_1.default({ allErrors: true, strict: false });
        (0, ajv_formats_1.default)(ajv);
    }
    if (!validateManifestFn) {
        const manifestSchemaFile = schemaPath || path_1.default.resolve(process.cwd(), 'schemas/dlm1-manifest.schema.json');
        const raw = fs_1.default.readFileSync(manifestSchemaFile, 'utf8');
        const schema = JSON.parse(raw);
        validateManifestFn = ajv.compile(schema);
    }
}
function validateDlm1Manifest(manifest) {
    if (!ajv || !validateManifestFn)
        initValidators();
    const ok = validateManifestFn(manifest);
    if (!ok) {
        return {
            ok: false,
            errors: validateManifestFn.errors,
        };
    }
    return { ok: true };
}
//# sourceMappingURL=index.js.map