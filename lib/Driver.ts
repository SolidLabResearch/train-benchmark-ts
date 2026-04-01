import { createReadStream } from 'fs';
import { QueryEngineBase } from '@comunica/actor-init-query';
import { StreamingStore } from '@incremunica/incremental-rdf-streaming-store';
import type { Quad } from '@incremunica/incremental-types';
import type { QueryEngine } from '@incremunica/query-sparql-incremental';
import type { OTerm } from 'n3';
import { StreamParser } from 'n3';
import type { BenchmarkConfig } from './Types';

export class Driver {
  private vertexId: number;

  public readonly queryEngine: QueryEngine;

  public readonly transformationQueryEngine: QueryEngine;

  public readonly streamingStore: StreamingStore<Quad>;

  public constructor(
    queryEngine: QueryEngine,
    streamingStore: StreamingStore<Quad>,
    vertexId: number,
    transformationQueryEngine: QueryEngine,
  ) {
    this.queryEngine = queryEngine;
    this.streamingStore = streamingStore;
    this.vertexId = vertexId;
    this.transformationQueryEngine = transformationQueryEngine;
  }

  public static async create(config: BenchmarkConfig): Promise<Driver> {
    //
    // const queryEnginePromise = new QueryEngineFactory().create({ configPath: config.queryEngineConfig });
    //
    // const transformationQueryEngine = new QueryEngineFactory().create({
    // configPath: `${__dirname}/../data/configs/full-hash-join/config.json`,
    // });
    //

    const queryEngine = new QueryEngineBase(require(config.queryEngineConfig));

    const transformationQueryEngine = new QueryEngineBase(require(
      `${__dirname}/../data/configs/full-hash-join/engine.js`,
    ));

    const data = await new Promise<{ store: StreamingStore<Quad>; VertexId: number }>((resolve, reject) => {
      const store = new StreamingStore<Quad>();
      const quadStream = createReadStream(config.dataPath).pipe(new StreamParser());
      store.import(quadStream);
      quadStream.on('end', async() => {
        const number = await Driver.determineInitialVertexId(store);
        resolve({ store, VertexId: number });
      });
      quadStream.on('error', error => {
        reject(error);
      });
    });

    return new Driver(queryEngine, data.store, data.VertexId, transformationQueryEngine);
    //
    // return Promise.all([ queryEnginePromise, dataPromise, transformationQueryEngine ])
    // .then(value => new Driver(value[0], value[1].store, value[1].VertexId, value[2]));
    //
  }

  private static async determineInitialVertexId(streamingStore: StreamingStore<Quad>): Promise<number> {
    const match = streamingStore.getStore().match();

    let highest = 0;

    match.on('data', quad => {
      const subject = Number.parseInt(quad.subject.value.split('_')[1], 10);
      const object = Number.parseInt(quad.object.value.split('_')[1], 10);

      if (highest < subject) {
        highest = subject;
      }
      if (highest < object) {
        highest = object;
      }
    });

    return await new Promise<number>(resolve => match.on('end', () => {
      resolve(highest);
    }));
  }

  public generateNewVertexId(): number {
    this.vertexId++;
    return this.vertexId;
  }

  public deleteQuads(subject: OTerm, predicate: OTerm, object: OTerm, graph: OTerm): void {
    for (const quad of this.streamingStore.getStore().getQuads(
      subject,
      predicate,
      object,
      graph,
    )
      ) {
      this.streamingStore.removeQuad(quad);
    }
  }
}
