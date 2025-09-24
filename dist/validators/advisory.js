"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAdvisoryValidator = initAdvisoryValidator;
exports.validateAdvisory = validateAdvisory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
let ajv = null;
let validateAdvFn = null;
function initAdvisoryValidator(schemaPath) {
    if (!ajv) {
        ajv = new ajv_1.default({ allErrors: true, strict: false });
        (0, ajv_formats_1.default)(ajv);
    }
    if (!validateAdvFn) {
        const p = schemaPath || path_1.default.resolve(process.cwd(), 'schemas/advisory.schema.json');
        const schema = JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
        validateAdvFn = ajv.compile(schema);
    }
}
function validateAdvisory(doc) {
    if (!ajv || !validateAdvFn)
        initAdvisoryValidator();
    const ok = validateAdvFn(doc);
    if (!ok)
        return { ok: false, errors: validateAdvFn.errors };
    return { ok: true };
}
//# sourceMappingURL=advisory.js.map