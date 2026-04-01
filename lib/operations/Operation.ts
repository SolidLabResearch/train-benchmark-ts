import * as fs from 'fs';
import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import type { Bindings, BindingsStream, Quad } from '@incremunica/incremental-types';
import type { Term } from 'n3';
import seedrandom = require('seedrandom');
import { HashBindings } from '../../../incremunica/packages/hash-bindings';
import { StreamingStore } from '../../../incremunica/packages/incremental-rdf-streaming-store';
import type { Driver } from '../Driver';
import type { BenchmarkConfig } from '../Types';

export class Operation {
  public readonly queryString: string;

  public readonly transformation: boolean;

  public readonly operationName: string;

  protected driver: Driver;

  protected streamingStore: StreamingStore<Quad>;

  private bindingsStream: BindingsStream | undefined;

  private readonly bindingsMap = new Map<string, { bindings: Bindings; count: number }>();

  private changeBindingsMap = new Map<string, number>();

  private readonly config: BenchmarkConfig;

  private readonly hashBindings = new HashBindings();

  public constructor(
    driver: Driver,
    config: BenchmarkConfig,
    transformation: boolean,
    queryString = '',
    operationName = '',
  ) {
    this.driver = driver;
    this.config = config;

    this.streamingStore = new StreamingStore<Quad>();

    for (const quad of driver.streamingStore.getStore()) {
      this.streamingStore.addQuad(<Quad>quad);
    }
    this.streamingStore.halt();
    this.streamingStore.import(this.driver.streamingStore.match());

    if (queryString === '') {
      throw new Error(`${this.operationName} does not overwrite 'queryString'`);
    }
    this.queryString = queryString;
    if (transformation === undefined) {
      throw new Error(`${this.operationName} does not overwrite 'transformation'`);
    }
    this.transformation = transformation;
    if (operationName === '') {
      throw new Error(`${this.operationName} does not overwrite 'operationName'`);
    }
    this.operationName = operationName;
  }

  public resume(): void {
    this.streamingStore.resume();
  }

  public halt(): void {
    this.streamingStore.halt();
  }

  public flush(): void {
    this.streamingStore.flush();
  }

  public async query(): Promise<{ deletions: number; additions: number; time: number }> {
    const result = { deletions: 0, additions: 0, time: 0 };
    for (const count of this.changeBindingsMap.values()) {
      if (count > 0) {
        result.additions += count;
      } else {
        result.deletions += count;
      }
    }

    let time = [ 0, 0 ];
    await new Promise<void>(async resolve => {
      if (this.bindingsStream === undefined) {
        if (this.transformation) {
          this.bindingsStream = <BindingsStream> await this.driver.transformationQueryEngine.queryBindings(
            this.queryString,
            {
              sources: [ this.streamingStore ],
            },
          );
        } else {
          this.bindingsStream = <BindingsStream> await this.driver.queryEngine.queryBindings(
            this.queryString,
            {
              sources: [ this.streamingStore ],
            },
          );
        }
      }

      const processBindings = (): void => {
        let bindings = this.bindingsStream!.read();
        while (bindings) {
          const hash = this.hashBindings.hash(bindings);
          const change = this.changeBindingsMap.get(hash);

          if (change === undefined) {
            this.changeBindingsMap.set(hash, bindings.diff ? -1 : 1);
          } else {
            const newChange = change + (bindings.diff ? -1 : 1);
            if (newChange === 0) {
              this.changeBindingsMap.delete(hash);
            } else {
              this.changeBindingsMap.set(hash, newChange);
            }
          }

          // Console.log(this.changeBindingsMap.size);

          const bindingsData = this.bindingsMap.get(hash);
          if (bindings.diff) {
            if (bindingsData) {
              bindingsData.count++;
              if (bindingsData.count === 0) {
                this.bindingsMap.delete(hash);
              }
            } else {
              this.bindingsMap.set(hash, { bindings, count: 1 });
            }
          } else if (bindingsData) {
            bindingsData.count--;
            if (bindingsData.count === 0) {
              this.bindingsMap.delete(hash);
            }
          } else {
            this.bindingsMap.set(hash, { bindings, count: -1 });
          }

          bindings = this.bindingsStream!.read();
        }

        time = process.hrtime(start);

        if (this.changeBindingsMap.size === 0) {
          this.bindingsStream!.removeAllListeners('readable');
          resolve();
        }
      };

      let start = process.hrtime();
      this.flush();
      processBindings();
      this.bindingsStream.on('readable', processBindings);
    });

    this.halt();

    // Console.log(this.operationName, 'number of total results:', this.bindingsMap.size);

    result.time = time[0] * 1_000 + time[1] / 1_000_000;
    return result;
  }

  public async getResults(cachedResults: any, runNum: number): Promise<void> {
    const changeBindingsMap = cachedResults[`${this.operationName}runNum${runNum.toString()}`];
    if (changeBindingsMap) {
      this.changeBindingsMap = new Map(Object.entries(changeBindingsMap));
    } else {
      const engine = new QueryEngine();
      const bindingsStream = await engine.queryBindings(
        this.queryString,
        {
          sources: [ this.driver.streamingStore.getStore() ],
        },
      );

      this.changeBindingsMap = new Map<string, number>();
      for (const element of this.bindingsMap) {
        this.changeBindingsMap.set(element[0], 0 - element[1].count);
      }

      bindingsStream.on('data', (bindings: Bindings) => {
        const hash = this.hashBindings.hash(bindings);
        const count = this.changeBindingsMap.get(hash);
        if (count === undefined) {
          this.changeBindingsMap.set(hash, 1);
        } else if (count === -1) {
          this.changeBindingsMap.delete(hash);
        } else {
          this.changeBindingsMap.set(hash, count + 1);
        }
      });

      await new Promise<void>(resolve => bindingsStream.on('end', () => resolve()));

      cachedResults[this.operationName + runNum.toString()] = Object.fromEntries(this.changeBindingsMap.entries());

      await new Promise<void>(resolve => fs.writeFile(
        cachedResults.cachedResultsFilePath,
        JSON.stringify(cachedResults),
        () => {
          resolve();
        },
      ));
    }
  }

  public async transform(): Promise<{ deletions: number; additions: number }> {
    const changes = await this.query();

    if (!this.streamingStore.isHalted()) {
      throw new Error('StreamingStore hasn\'t been halted');
    }

    const bindings: Bindings[] = this.getTransformMatches();

    // Console.log(this.operationName, 'bindings transform length', bindings.length);
    bindings.forEach(this._transform.bind(this));

    return { deletions: changes.deletions, additions: changes.additions };
  }

  protected _transform(bindings: Bindings): void {
    throw new Error(`${this.operationName} does not overwrite '_transform()'.`);
  }

  private getTransformMatches(): Bindings[] {
    const rng = seedrandom(this.config.randomSeed);
    let size = 0;

    if (this.config.matchTransformPercentage) {
      size = Math.floor(this.config.matchTransformPercentage / 100 * this.bindingsMap.size);
    } else {
      size = this.config.matchTransformAmount;
    }

    const bindings = [ ...this.bindingsMap.values() ]
      .map(values => values.bindings)
      .sort((bindings1: Bindings, bindings2: Bindings) => {
        if (this.hashBindings.hash(bindings1) < this.hashBindings.hash(bindings2)) {
          return -1;
        }
        if (this.hashBindings.hash(bindings1) > this.hashBindings.hash(bindings2)) {
          return 1;
        }
        return 0;
      }).slice(0, size);

    for (let i = bindings.length; i > 1; i--) {
      const int = Math.floor(rng() * bindings.length);
      const temp = bindings[int];
      bindings[int] = bindings[i - 1];
      bindings[i - 1] = temp;
    }

    return bindings;
  }

  protected getSafe(bindings: Bindings, variable: string): Term {
    const term = <Term>bindings.get(variable);
    if (term === undefined) {
      throw new Error(`${this.operationName} specified variable: ${variable}`);
    }
    return term;
  }
}
