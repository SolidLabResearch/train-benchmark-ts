import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import { NamedNode } from 'n3';
import { BASE_PREFIX, CONNECTS_TO, RDF, SWITCH } from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class InjectChain extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?switch ?trackElement
WHERE {
    ?switch base:connectsTo ?trackElement .
    ?switch a base:Switch .
}
`,
      'inject chain',
    );
  }

  protected _transform(bindings: Bindings): void {
    const newSwitch = new NamedNode(`${BASE_PREFIX}_${this.driver.generateNewVertexId()}`);

    const switchElement = this.getSafe(bindings, 'switch');
    const trackElement = this.getSafe(bindings, 'trackElement');

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      RDF.type,
      SWITCH,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      switchElement,
      CONNECTS_TO,
      newSwitch,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      CONNECTS_TO,
      trackElement,
    ));
  }
}
