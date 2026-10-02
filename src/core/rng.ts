/** Random source returning a value in [0, 1). Injectable so tests and a future server can control it. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;
