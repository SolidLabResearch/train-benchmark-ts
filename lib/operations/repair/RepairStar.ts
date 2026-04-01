import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import { MONITORED_BY } from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class RepairStar extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?switch ?sensor
WHERE {
    ?switch a base:Switch .
    ?switch base:monitoredBy ?sensor .
}
`,
      'repair star',
    );
  }

  protected _transform(bindings: Bindings): void {
    const switchElement = this.getSafe(bindings, 'switch');
    const sensor = this.getSafe(bindings, 'sensor');

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      MONITORED_BY,
      sensor,
    ));
  }
}
