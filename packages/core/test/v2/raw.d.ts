/*
 * Vite's `?raw` import, typed for the one place core's tests use it: real-content.test.ts reads the
 * client's reveal sketch out of docs/GAME_DESIGN_V2.md, so the glance bound is derived from the
 * drawing rather than copied from it (PAUL_BRIEF trap 5). Core's tsconfig has `types: []`, so
 * neither node's `fs` nor `vite/client` is in scope, and this is the narrowest declaration that
 * lets the test read a document as text.
 */
declare module '*.md?raw' {
  const text: string;
  export default text;
}
