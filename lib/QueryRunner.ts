import * as fs from 'fs';
import { appendFile } from 'fs/promises';
import { Driver } from './Driver';
import type { Operation } from './operations/Operation';
import { OperationFactory } from './operations/OperationFactory';
import type { BenchmarkConfig } from './Types';

export class QueryRunner {
  private readonly operations: Operation[];

  private readonly benchmarkConfig: BenchmarkConfig;

  private readonly cachedResults: any;

  public constructor(
    operations: Operation[],
    benchmarkConfig: BenchmarkConfig,
    cachedResults: any = {},
  ) {
    this.operations = operations;
    this.benchmarkConfig = benchmarkConfig;
    this.cachedResults = cachedResults;
  }

  public static BuildCSVHeader(benchmarkConfig: BenchmarkConfig): string {
    return 'operationName,' +
      'runNr,' +
      'transformationNr,' +
      'queryTime(miliseconds),' +
      'memoryUsed,' +
      'additions,' +
      'deletions\n';
  }

  public static async setupQueryRunner(
    benchmarkConfig: BenchmarkConfig,
  ): Promise<QueryRunner> {
    // Init + read
    // console.log('init + read');
    const driver = await Driver.create(benchmarkConfig);

    const operations = [];
    for (const operationSting of benchmarkConfig.operationStrings) {
      operations.push(OperationFactory.create(operationSting, driver, benchmarkConfig));
    }

    const pathArray = benchmarkConfig.dataPath.split('/');
    const cachedResultsFilePath = `${benchmarkConfig.cachedResultsBasePath +
    benchmarkConfig.randomSeed}#${
      benchmarkConfig.operationStrings
        .map(str => str.replace(/([A-Z][a-z]*)/ug, match => match.slice(0, 3))).join('#')}#${
      benchmarkConfig.matchTransformPercentage}#${
      pathArray[pathArray.length - 1]}.json`;

    const cachedResults = await new Promise<any>((resolve, reject) => {
      fs.readFile(
        cachedResultsFilePath,
        'utf8',
        (error, data) => {
          if (error) {
            resolve({});
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        },
      );
    });

    cachedResults.cachedResultsFilePath = cachedResultsFilePath;

    return new QueryRunner(operations, benchmarkConfig, cachedResults);
  }

  public async run(): Promise<void> {
    const benchmarkResults: {
      operationName: string;
      transformationNr: number;
      queryTimems: number;
      memoryDiff: number;
      memoryUsed: number;
      additions: number;
      deletions: number;
    }[] = [];

    // eslint-disable-next-line no-console
    console.log('Query');
    // Query
    for (const operation of this.operations) {
      if (!operation.transformation) {
        await operation.getResults(this.cachedResults, 0);

        const memoryBefore = process.memoryUsage().heapUsed;
        const result = await operation.query();
        const memoryAfter = process.memoryUsage().heapUsed;

        benchmarkResults.push({
          operationName: operation.operationName,
          transformationNr: 0,
          queryTimems: result.time,
          memoryDiff: memoryAfter - memoryBefore,
          memoryUsed: memoryAfter,
          additions: result.additions,
          deletions: result.deletions,
        });
      }
    }

    for (let i = 1; i < this.benchmarkConfig.numberOfTransforms + 1; i++) {
      // eslint-disable-next-line no-console
      console.log('Transform');
      // Transform
      for (const operation of this.operations) {
        if (operation.transformation) {
          await operation.getResults(this.cachedResults, i);
          await operation.transform();
        }
      }
      // eslint-disable-next-line no-console
      console.log('Recheck');
      // Recheck
      for (const operation of this.operations) {
        if (!operation.transformation) {
          await operation.getResults(this.cachedResults, i);

          const memoryBefore = process.memoryUsage().heapUsed;
          const result = await operation.query();
          const memoryAfter = process.memoryUsage().heapUsed;

          benchmarkResults.push({
            operationName: operation.operationName,
            transformationNr: i,
            queryTimems: result.time,
            memoryDiff: memoryAfter - memoryBefore,
            memoryUsed: memoryAfter,
            additions: result.additions,
            deletions: result.deletions,
          });
        }
      }
    }

    if (this.benchmarkConfig.runNr >= 0) {
      let content = '';
      for (const result of benchmarkResults) {
        content += `${result.operationName},`;
        content += `${this.benchmarkConfig.runNr},`;
        content += `${result.transformationNr},`;
        content += `${result.queryTimems},`;
        content += `${result.memoryUsed},`;
        content += `${result.additions},`;
        content += `${result.deletions}\n`;
      }

      await appendFile(this.benchmarkConfig.resultsPath, content);
    }
  }
}
