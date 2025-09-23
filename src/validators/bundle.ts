import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

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

export const validateBundle = ajv.compile(bundleSchema);
export const validateSpvEnvelope = ajv.compile(spvEnvelopeSchema);
