import { qDev, qRuntimeQrl } from '../utils/qdev';
import type { QRLDev } from './qrl';
import { SYNC_QRL, createQRL } from './qrl-class';

// We use `unknown` instead of `never` when it's not a function so we allow assigning QRL<function> to QRL<any>
export type QrlArgs<T> = T extends (...args: infer ARGS) => any ? ARGS : unknown[];
export type QrlReturn<T> = T extends (...args: any) => infer R ? Awaited<R> : unknown;

// <docs markdown="../../readme.md#QRL">
// !!DO NOT EDIT THIS COMMENT DIRECTLY!!!
// (edit ../../readme.md#QRL instead and run `pnpm docs.sync`)
/**
 * The `QRL` type represents a lazy-loadable AND serializable resource.
 *
 * QRL stands for Qwik URL.
 *
 * Use `QRL` when you want to refer to a lazy-loaded resource. `QRL`s are most often used for code
 * (functions) but can also be used for other resources such as `string`s in the case of styles.
 *
 * `QRL` is an opaque token that is generated by the Qwik Optimizer. (Do not rely on any properties
 * in `QRL` as it may change between versions.)
 *
 * ## Creating `QRL` references
 *
 * Creating `QRL` is done using `$(...)` function. `$(...)` is a special marker for the Qwik
 * Optimizer that marks that the code should be extracted into a lazy-loaded symbol.
 *
 * ```tsx
 * useOnDocument(
 *   'mousemove',
 *   $((event) => console.log('mousemove', event))
 * );
 * ```
 *
 * In the above code, the Qwik Optimizer detects `$(...)` and transforms the code as shown below:
 *
 * ```tsx
 * // FILE: <current file>
 * useOnDocument('mousemove', qrl('./chunk-abc.js', 'onMousemove'));
 *
 * // FILE: chunk-abc.js
 * export const onMousemove = () => console.log('mousemove');
 * ```
 *
 * NOTE: `qrl(...)` is a result of Qwik Optimizer transformation. You should never have to invoke
 * this function directly in your application. The `qrl(...)` function should be invoked only after
 * the Qwik Optimizer transformation.
 *
 * ## Using `QRL`s
 *
 * Use `QRL` type in your application when you want to get a lazy-loadable reference to a resource
 * (most likely a function).
 *
 * ```tsx
 * // Example of declaring a custom functions which takes callback as QRL.
 * export function useMyFunction(callback: QRL<() => void>) {
 *   doExtraStuff();
 *   // The callback passed to `onDocument` requires `QRL`.
 *   useOnDocument('mousemove', callback);
 * }
 * ```
 *
 * In the above example, the way to think about the code is that you are not asking for a callback
 * function but rather a reference to a lazy-loadable callback function. Specifically, the function
 * loading should be delayed until it is actually needed. In the above example, the function would
 * not load until after a `mousemove` event on `document` fires.
 *
 * ## Resolving `QRL` references
 *
 * At times it may be necessary to resolve a `QRL` reference to the actual value. This can be
 * performed using `QRL.resolve(..)` function.
 *
 * ```tsx
 * // Assume you have QRL reference to a greet function
 * const lazyGreet: QRL<() => void> = $(() => console.log('Hello World!'));
 *
 * // Use `qrlImport` to load / resolve the reference.
 * const greet: () => void = await lazyGreet.resolve();
 *
 * //  Invoke it
 * greet();
 * ```
 *
 * NOTE: `element` is needed because `QRL`s are relative and need a base location to resolve
 * against. The base location is encoded in the HTML in the form of `<div q:base="/url">`.
 *
 * ## `QRL.resolved`
 *
 * Once `QRL.resolve()` returns, the value is stored under `QRL.resolved`. This allows the value to
 * be used without having to await `QRL.resolve()` again.
 *
 * ## Question: Why not just use `import()`?
 *
 * At first glance, `QRL` serves the same purpose as `import()`. However, there are three subtle
 * differences that need to be taken into account.
 *
 * 1. `QRL`s must be serializable into HTML.
 * 2. `QRL`s must be resolved by framework relative to `q:base`.
 * 3. `QRL`s must be able to capture lexically scoped variables.
 * 4. `QRL`s encapsulate the difference between running with and without Qwik Optimizer.
 * 5. `QRL`s allow expressing lazy-loaded boundaries without thinking about chunk and symbol names.
 *
 * Let's assume that you intend to write code such as this:
 *
 * ```tsx
 * return <button onClick={() => (await import('./chunk-abc.js')).onClick}>
 * ```
 *
 * The above code needs to be serialized into DOM such as:
 *
 * ```
 * <div q:base="/build/">
 *   <button on:click="./chunk-abc.js#onClick">...</button>
 * </div>
 * ```
 *
 * 1. Notice there is no easy way to extract chunk (`./chunk-abc.js`) and symbol (`onClick`) into HTML.
 * 2. Notice that even if you could extract it, the `import('./chunk-abc.js')` would become relative to
 *    where the `import()` file is declared. Because it is our framework doing the load, the
 *    `./chunk-abc.js` would become relative to the framework file. This is not correct, as it
 *    should be relative to the original file generated by the bundler.
 * 3. Next, the framework needs to resolve the `./chunk-abc.js` and needs a base location that is
 *    encoded in the HTML.
 * 4. The QRL needs to be able to capture lexically scoped variables. (`import()` only allows loading
 *    top-level symbols which don't capture variables.)
 * 5. As a developer, you don't want to think about `import` and naming the chunks and symbols. You
 *    just want to say: "this should be lazy."
 *
 * These are the main reasons why Qwik introduces its own concept of `QRL`.
 *
 * @public
 * @see `$`
 */
// </docs>
export type QRL<TYPE = unknown> = {
  // Special type brand to let eslint that the Type is serializable
  __qwik_serializable__?: any;
  __brand__QRL__: TYPE;

  /** Resolve the QRL and return the actual value. */
  resolve(): Promise<TYPE>;
  /** The resolved value, once `resolve()` returns. */
  resolved: undefined | TYPE;

  getCaptured(): unknown[] | null;
  getSymbol(): string;
  getHash(): string;
  dev: QRLDev | null;
} & BivariantQrlFn<QrlArgs<TYPE>, QrlReturn<TYPE>>;

// https://stackoverflow.com/questions/52667959/what-is-the-purpose-of-bivariancehack-in-typescript-types/52668133#52668133
type BivariantQrlFn<ARGS extends any[], RETURN> = {
  /**
   * Resolve the QRL of closure and invoke it.
   *
   * @param args - Closure arguments.
   * @returns A promise of the return value of the closure.
   */
  bivarianceHack(...args: ARGS): Promise<RETURN>;
}['bivarianceHack'];

let runtimeSymbolId = 0;

/**
 * Alias for `QRL<T>`. Of historic relevance only.
 *
 * @public
 */
export type PropFunction<T> = QRL<T>;

// <docs markdown="../../readme.md#$">
// !!DO NOT EDIT THIS COMMENT DIRECTLY!!!
// (edit ../../readme.md#$ instead and run `pnpm docs.sync`)
/**
 * Qwik Optimizer marker function.
 *
 * Use `$(...)` to tell Qwik Optimizer to extract the expression in `$(...)` into a lazy-loadable
 * resource referenced by `QRL`.
 *
 * @param expression - Expression which should be lazy loaded
 * @public
 * @see `implicit$FirstArg` for additional `____$(...)` rules.
 *
 * In this example, `$(...)` is used to capture the callback function of `onmousemove` into a
 * lazy-loadable reference. This allows the code to refer to the function without actually
 * loading the function. In this example, the callback function does not get loaded until
 * `mousemove` event fires.
 *
 * ```tsx
 * useOnDocument(
 *   'mousemove',
 *   $((event) => console.log('mousemove', event))
 * );
 * ```
 *
 * In this code, the Qwik Optimizer detects `$(...)` and transforms the code into:
 *
 * ```tsx
 * // FILE: <current file>
 * useOnDocument('mousemove', qrl('./chunk-abc.js', 'onMousemove'));
 *
 * // FILE: chunk-abc.js
 * export const onMousemove = () => console.log('mousemove');
 * ```
 *
 * ## Special Rules
 *
 * The Qwik Optimizer places special rules on functions that can be lazy-loaded.
 *
 * 1. The expression of the `$(expression)` function must be importable by the system.
 * (expression shows up in `import` or has `export`)
 * 2. If inlined function, then all lexically captured values must be:
 *    - importable (vars show up in `import`s or `export`s)
 *    - const (The capturing process differs from JS capturing in that writing to captured
 * variables does not update them, and therefore writes are forbidden. The best practice is that
 * all captured variables are constants.)
 *    - Must be runtime serializable.
 *
 * ```tsx
 *
 * import { createContextId, useContext, useContextProvider } from './use/use-context';
 * import { Resource } from './use/use-resource';
 * import { useResource$ } from './use/use-resource-dollar';
 * import { useSignal } from './use/use-signal';
 *
 * export const greet = () => console.log('greet');
 * function topLevelFn() {}
 *
 * function myCode() {
 *   const store = useStore({});
 *   function localFn() {}
 *   // Valid Examples
 *   $(greet); // greet is importable
 *   $(() => greet()); // greet is importable;
 *   $(() => console.log(store)); // store is serializable.
 *
 *   // Compile time errors
 *   $(topLevelFn); // ERROR: `topLevelFn` not importable
 *   $(() => topLevelFn()); // ERROR: `topLevelFn` not importable
 *
 *   // Runtime errors
 *   $(localFn); // ERROR: `localFn` fails serialization
 *   $(() => localFn()); // ERROR: `localFn` fails serialization
 * }
 *
 * ```
 */
// </docs>
export const $ = <T>(expression: T): QRL<T> => {
  if (!qRuntimeQrl && qDev) {
    throw new Error(
      'Optimizer should replace all usages of $() with some special syntax. If you need to create a QRL manually, use inlinedQrl() instead.'
    );
  }

  return createQRL<T>(null, 's' + runtimeSymbolId++, expression, null, null, null, null);
};
/** @private Use To avoid optimizer replacement */
export const dollar = $;

/** @internal */
export const eventQrl = <T>(qrl: QRL<T>): QRL<T> => {
  return qrl;
};

/** @public */
export interface SyncQRL<TYPE extends Function = any> extends QRL<TYPE> {
  __brand__SyncQRL__: TYPE;

  /**
   * Resolve the QRL of closure and invoke it.
   *
   * @param args - Closure arguments.
   * @returns A return value of the closure.
   */
  (
    ...args: TYPE extends (...args: infer ARGS) => any ? ARGS : never
  ): TYPE extends (...args: any[]) => infer RETURN ? RETURN : never;

  resolved: TYPE;
  dev: QRLDev | null;
}

/**
 * Extract function into a synchronously loadable QRL.
 *
 * NOTE: Synchronous QRLs functions can't close over any variables, including exports.
 *
 * @param fn - Function to extract.
 * @returns
 * @public
 */
export const sync$ = <T extends Function>(fn: T): SyncQRL<T> => {
  if (!qRuntimeQrl && qDev) {
    throw new Error(
      'Optimizer should replace all usages of sync$() with some special syntax. If you need to create a QRL manually, use inlinedSyncQrl() instead.'
    );
  }
  if (qDev) {
    // To make sure that in dev mode we don't accidentally capture context in `sync$()` we serialize and deserialize the function.
    // eslint-disable-next-line no-new-func
    fn = new Function('return ' + fn.toString())() as any;
  }

  return createQRL<T>('', SYNC_QRL, fn, null, null, null, null) as any;
};

/**
 * Extract function into a synchronously loadable QRL.
 *
 * NOTE: Synchronous QRLs functions can't close over any variables, including exports.
 *
 * @param fn - Extracted function
 * @param serializedFn - Serialized function in string form.
 * @returns
 * @internal
 */
export const _qrlSync = function <TYPE extends Function>(
  fn: TYPE,
  serializedFn?: string
): SyncQRL<TYPE> {
  if (serializedFn === undefined) {
    serializedFn = fn.toString();
  }
  (fn as any).serialized = serializedFn;
  return createQRL<TYPE>('', SYNC_QRL, fn, null, null, null, null) as any;
};
