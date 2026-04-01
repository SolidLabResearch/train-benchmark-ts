import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import { NamedNode } from 'n3';
import { BASE_PREFIX, CURRENTPOSITION, RDF, SWITCH } from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import { Position } from '../../PositionUtils';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class InjectCartesian extends TransformationOperation {
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
      'inject cartesian',
    );
  }

  protected _transform(bindings: Bindings): void {
    const newSwitch = new NamedNode(`${BASE_PREFIX}_${this.driver.generateNewVertexId()}`);

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      CURRENTPOSITION,
      new Position(0).toTerm(),
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      RDF.type,
      SWITCH,
    ));
  }
}
