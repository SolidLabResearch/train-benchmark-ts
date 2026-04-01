import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import { NamedNode } from 'n3';
import { BASE_PREFIX, MONITORED_BY, RDF, SENSOR } from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class InjectStar extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?switch
WHERE {
    ?switch a base:Switch .
}
`,
      'inject star',
    );
  }

  protected _transform(bindings: Bindings): void {
    const id = this.driver.generateNewVertexId();

    const switchElement = this.getSafe(bindings, 'switch');
    const newSensor = new NamedNode(`${BASE_PREFIX}_${id}`);

    this.driver.streamingStore.addQuad(new Quad(
      switchElement,
      MONITORED_BY,
      newSensor,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSensor,
      RDF.type,
      SENSOR,
    ));
  }
}
