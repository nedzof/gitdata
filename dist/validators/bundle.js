"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSpvEnvelope = exports.validateBundle = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const ajv = new ajv_1.default();
(0, ajv_formats_1.default)(ajv);
const bundleSchema = {
    type: 'object',
    properties: {
        versionIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
        },
    },
    required: ['versionIds'],
    additionalProperties: false,
};
const spvEnvelopeSchema = {
    type: 'object',
    properties: {
        rawTx: { type: 'string' },
        proof: {
            type: 'object',
            properties: {
                blockHash: { type: 'string' },
                merkleRoot: { type: 'string' },
                nodes: {
                    type: 'array',
                    items: { type: 'string' },
                },
                index: { type: 'number', minimum: 0 },
            },
            required: ['blockHash', 'merkleRoot', 'nodes', 'index'],
            additionalProperties: false,
        },
    },
    required: ['rawTx', 'proof'],
    additionalProperties: false,
};
exports.validateBundle = ajv.compile(bundleSchema);
exports.validateSpvEnvelope = ajv.compile(spvEnvelopeSchema);
//# sourceMappingURL=bundle.js.map