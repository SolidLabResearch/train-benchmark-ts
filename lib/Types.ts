export type Time = [number, number];
/* eslint @typescript-eslint/consistent-type-definitions: ["error", "type"] */
export type BenchmarkConfig = {
  operationStrings: string[];
  matchTransformPercentage: number;
  matchTransformAmount: number;
  numberOfTransforms: number;
  randomSeed: string;
  queryEngineConfig: string;
  dataPath: string;
  resultsPath: string;
  cachedResultsBasePath: string;
  runNr: number;
};
