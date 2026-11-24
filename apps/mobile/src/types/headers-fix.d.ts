/**
 * React Native 0.76's `globals.d.ts` declares `Headers.forEach(callback: Function)`,
 * which shadows DOM's typed callback signature when strict `noImplicitAny` checks
 * shared platform-neutral packages like `@fastbuild/api-client`.
 */
interface Headers {
  forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: unknown): void;
}
