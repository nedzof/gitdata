"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacetValidator = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
class FacetValidator {
    constructor() {
        this.compiledSchemas = new Map();
        this.ajv = new ajv_1.default({
            allErrors: true,
            strict: false,
            removeAdditional: false,
        });
        (0, ajv_formats_1.default)(this.ajv);
        // Load facet registry
        try {
            const registryPath = (0, path_1.resolve)(__dirname, '../schemas/facet-registry.json');
            const registryContent = (0, fs_1.readFileSync)(registryPath, 'utf-8');
            this.registry = JSON.parse(registryContent);
            // Pre-compile schemas
            this.loadSchemas();
        }
        catch (error) {
            console.error('Failed to load facet registry:', error);
            throw new Error('Facet validator initialization failed');
        }
    }
    loadSchemas() {
        for (const [facetName, facetDef] of Object.entries(this.registry.facets)) {
            if (facetDef.localPath) {
                try {
                    const schemaPath = (0, path_1.resolve)(__dirname, '../..', facetDef.localPath);
                    const schemaContent = (0, fs_1.readFileSync)(schemaPath, 'utf-8');
                    const schema = JSON.parse(schemaContent);
                    const validator = this.ajv.compile(schema);
                    this.compiledSchemas.set(facetName, validator);
                }
                catch (error) {
                    console.warn(`Failed to load schema for facet ${facetName}:`, error);
                }
            }
        }
    }
    validateOpenLineageEvent(event) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
        };
        // Validate core OpenLineage structure
        const coreValidation = this.validateCoreStructure(event);
        if (!coreValidation.valid) {
            result.valid = false;
            result.errors.push(...coreValidation.errors);
        }
        // Validate run facets
        if (event.run?.facets) {
            const runFacetsValidation = this.validateFacets(event.run.facets, 'run');
            if (!runFacetsValidation.valid) {
                result.valid = false;
                result.errors.push(...runFacetsValidation.errors);
            }
            result.warnings.push(...runFacetsValidation.warnings);
        }
        // Validate dataset facets (inputs and outputs)
        const datasets = [...(event.inputs || []), ...(event.outputs || [])];
        for (let i = 0; i < datasets.length; i++) {
            const dataset = datasets[i];
            if (dataset.facets) {
                const datasetFacetsValidation = this.validateFacets(dataset.facets, 'dataset', `dataset[${i}]`);
                if (!datasetFacetsValidation.valid) {
                    result.valid = false;
                    result.errors.push(...datasetFacetsValidation.errors);
                }
                result.warnings.push(...datasetFacetsValidation.warnings);
            }
        }
        return result;
    }
    validateCoreStructure(event) {
        const result = { valid: true, errors: [], warnings: [] };
        // Required fields
        const requiredFields = ['eventType', 'eventTime', 'producer', 'job', 'run'];
        for (const field of requiredFields) {
            if (!event[field]) {
                result.valid = false;
                result.errors.push(`Missing required field: ${field}`);
            }
        }
        // Event type validation
        if (event.eventType && !['START', 'COMPLETE', 'ABORT'].includes(event.eventType)) {
            result.valid = false;
            result.errors.push(`Invalid eventType: ${event.eventType}`);
        }
        // Job structure validation
        if (event.job) {
            if (!event.job.namespace || !event.job.name) {
                result.valid = false;
                result.errors.push('Job must have namespace and name');
            }
        }
        // Run structure validation
        if (event.run && !event.run.runId) {
            result.valid = false;
            result.errors.push('Run must have runId');
        }
        return result;
    }
    validateFacets(facets, context, prefix = '') {
        const result = { valid: true, errors: [], warnings: [] };
        for (const [facetName, facetData] of Object.entries(facets)) {
            const facetValidation = this.validateSingleFacet(facetName, facetData, context, prefix);
            if (!facetValidation.valid) {
                result.valid = false;
                result.errors.push(...facetValidation.errors);
            }
            result.warnings.push(...facetValidation.warnings);
        }
        return result;
    }
    validateSingleFacet(facetName, facetData, context, prefix = '') {
        const result = { valid: true, errors: [], warnings: [] };
        const fullName = prefix ? `${prefix}.${facetName}` : facetName;
        // Check facet size
        const facetSize = JSON.stringify(facetData).length;
        if (facetSize > this.registry.validation.maxFacetSize) {
            result.valid = false;
            result.errors.push(`Facet ${fullName} exceeds size limit: ${facetSize} > ${this.registry.validation.maxFacetSize}`);
            return result;
        }
        // Check if facet is known
        const facetDef = this.registry.facets[facetName];
        if (!facetDef) {
            if (!this.registry.validation.allowUnknownFacets) {
                result.valid = false;
                result.errors.push(`Unknown facet: ${fullName}`);
                return result;
            }
            else {
                result.warnings.push(`Unknown facet (allowed): ${fullName}`);
                return result;
            }
        }
        // Check context
        if (!facetDef.context.includes(context)) {
            result.warnings.push(`Facet ${fullName} used in unexpected context: ${context}, expected: ${facetDef.context.join(', ')}`);
        }
        // Validate against schema if available
        if (this.registry.validation.validateSchemas && this.compiledSchemas.has(facetName)) {
            const validator = this.compiledSchemas.get(facetName);
            const isValid = validator(facetData);
            if (!isValid) {
                result.valid = false;
                const errors = validator.errors || [];
                for (const error of errors) {
                    result.errors.push(`Schema validation error in ${fullName}: ${error.instancePath} ${error.message}`);
                }
            }
        }
        // Check for required producer metadata in custom facets
        if (facetDef.version !== 'standard') {
            if (!facetData._producer) {
                result.warnings.push(`Custom facet ${fullName} missing _producer field`);
            }
            if (!facetData._schemaURL) {
                result.warnings.push(`Custom facet ${fullName} missing _schemaURL field`);
            }
        }
        return result;
    }
    getFacetRegistry() {
        return this.registry;
    }
    isKnownFacet(facetName) {
        return Object.prototype.hasOwnProperty.call(this.registry.facets, facetName);
    }
    getRequiredFacets(context) {
        return Object.entries(this.registry.facets)
            .filter(([_, def]) => def.required && def.context.includes(context))
            .map(([name, _]) => name);
    }
}
exports.FacetValidator = FacetValidator;
//# sourceMappingURL=facet-validator.js.map