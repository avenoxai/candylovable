import 'vitest'

// vitest-axe ships a `namespace Vi` augmentation that Vitest 3's Assertion type no
// longer reads. Re-declare the matcher against the `vitest` module so tsc sees it.
interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends AxeMatchers<T> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
