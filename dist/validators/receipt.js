"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initReceiptValidator = initReceiptValidator;
exports.validateReceipt = validateReceipt;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
let ajv = null;
let validateReceiptFn = null;
function initReceiptValidator(schemaPath) {
    if (!ajv) {
        ajv = new ajv_1.default({ allErrors: true, strict: false });
        (0, ajv_formats_1.default)(ajv);
    }
    if (!validateReceiptFn) {
        const p = schemaPath || path_1.default.resolve(process.cwd(), 'schemas/receipt.schema.json');
        const schema = JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
        validateReceiptFn = ajv.compile(schema);
    }
}
function validateReceipt(doc) {
    if (!ajv || !validateReceiptFn)
        initReceiptValidator();
    const ok = validateReceiptFn(doc);
    if (!ok)
        return { ok: false, errors: validateReceiptFn.errors };
    return { ok: true };
}
//# sourceMappingURL=receipt.js.map