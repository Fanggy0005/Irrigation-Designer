/**
 * Wraps `fn` so a call with the same arguments as the previous call (compared with ===)
 * returns the previous result. The editor's store replaces only the parts of the design
 * that change, so this recomputes derived data (plants, zones, laterals) once per edit
 * however many components ask for it.
 */
export function memoizeLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    let last: { args: A; result: R } | null = null;
    return (...args: A) => {
        if (last && last.args.length === args.length && last.args.every((a, i) => a === args[i])) return last.result;
        const result = fn(...args);
        last = { args, result };
        return result;
    };
}
