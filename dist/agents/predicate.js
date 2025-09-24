"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evalPredicate = evalPredicate;
function get(ctx, path) {
    const parts = path.split('.');
    let v = ctx;
    for (const p of parts)
        v = v?.[p];
    return v;
}
function evalPredicate(pred, ctx) {
    if (!pred || typeof pred !== 'object')
        return true;
    if ('and' in pred)
        return pred.and.every((p) => evalPredicate(p, ctx));
    if ('or' in pred)
        return pred.or.some((p) => evalPredicate(p, ctx));
    if ('not' in pred)
        return !evalPredicate(pred.not, ctx);
    if ('gt' in pred)
        return Object.entries(pred.gt).every(([k, v]) => Number(get(ctx, k)) > Number(v));
    if ('gte' in pred)
        return Object.entries(pred.gte).every(([k, v]) => Number(get(ctx, k)) >= Number(v));
    if ('lt' in pred)
        return Object.entries(pred.lt).every(([k, v]) => Number(get(ctx, k)) < Number(v));
    if ('lte' in pred)
        return Object.entries(pred.lte).every(([k, v]) => Number(get(ctx, k)) <= Number(v));
    if ('eq' in pred)
        return Object.entries(pred.eq).every(([k, v]) => get(ctx, k) === v);
    if ('includes' in pred) {
        return Object.entries(pred.includes).every(([k, v]) => {
            const val = get(ctx, k);
            if (Array.isArray(val))
                return val.map((x) => String(x).toLowerCase()).includes(String(v).toLowerCase());
            if (typeof val === 'string')
                return val.toLowerCase().includes(String(v).toLowerCase());
            return false;
        });
    }
    return true;
}
//# sourceMappingURL=predicate.js.map