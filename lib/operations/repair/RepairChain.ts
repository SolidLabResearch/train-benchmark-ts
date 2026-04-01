import type { Bindings } from '@incremunica/incremental-types';
import type { Driver } from '../../Driver';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class RepairChain extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?segment
WHERE {
    ?switch base:connectsTo ?segment .
    ?switch a base:Switch .
    ?segment a base:Segment .
}
`,
      'repair chain',
    );
  }

  protected _transform(bindings: Bindings): void {
    const segment = this.getSafe(bindings, 'segment');

    this.driver.deleteQuads(
      segment,
      null,
      null,
      null,
    );

    this.driver.deleteQuads(
      null,
      null,
      segment,
      null,
    );
  }
}
