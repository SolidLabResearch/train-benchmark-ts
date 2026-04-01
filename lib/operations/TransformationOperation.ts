import type { Driver } from '../Driver';
import type { BenchmarkConfig } from '../Types';
import { Operation } from './Operation';

export class TransformationOperation extends Operation {
  public constructor(driver: Driver,
                     config: BenchmarkConfig,
                     queryString: string,
                     operationName: string) {
    super(driver,
      config,
      true,
      queryString,
      operationName);
  }
}
