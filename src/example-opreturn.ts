// src/example-opreturn.ts
import { buildOpReturnScript, buildOpReturnScriptMulti, composeTag } from '../builders/opreturn';

// Imagine you already have canonical CBOR bytes for DLM1/TRN1:
const dlm1Cbor = new Uint8Array([/* ... */]);
const trn1Cbor = new Uint8Array([/* ... */]);

const dlm1Blob = composeTag('DLM1', dlm1Cbor);
const trn1Blob = composeTag('TRN1', trn1Cbor);

// Single OP_RETURN output with one push:
const singleScriptHex = buildOpReturnScript(dlm1Blob);

// Single OP_RETURN with multiple pushes:
const multiScriptHex = buildOpReturnScriptMulti([dlm1Blob, trn1Blob]);

// Use with a BRC-100 wallet build-and-sign flow (build outputs and sign tx)
const outputs = [{ scriptHex: multiScriptHex, satoshis: 0 }];
