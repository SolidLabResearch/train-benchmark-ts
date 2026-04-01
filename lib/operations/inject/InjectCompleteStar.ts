import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import { NamedNode } from 'n3';
import {
  BASE_PREFIX,
  CONNECTS_TO,
  CURRENTPOSITION, ELEMENTS,
  MONITORED_BY, POSITION,
  RDF,
  SWITCH, SWITCHPOSITION, TARGET,
  TRACKELEMENT,
} from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import { Position } from '../../PositionUtils';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class InjectCompleteStar extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?sensor ?region ?trackElementBefore ?trackElementAfter
WHERE {
    ?switch a base:Switch .
    ?trackElementBefore base:connectsTo ?switch .
    ?switch base:connectsTo ?trackElementAfter .
    ?switch base:monitoredBy ?sensor .
    ?region base:elements ?switch .
}
`,
      'inject complete star',
    );
  }

  protected _transform(bindings: Bindings): void {
    const id1 = this.driver.generateNewVertexId();
    const id2 = this.driver.generateNewVertexId();

    const newSwitch = new NamedNode(`${BASE_PREFIX}_${id1}`);
    const newSwitchPosition = new NamedNode(`${BASE_PREFIX}_${id2}`);
    const sensor = this.getSafe(bindings, 'sensor');
    const region = this.getSafe(bindings, 'region');
    const trackElementBefore = this.getSafe(bindings, 'sensor');
    const trackElementAfter = this.getSafe(bindings, 'region');
    const position = new Position(1).toTerm();

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      RDF.type,
      SWITCH,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      MONITORED_BY,
      sensor,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      RDF.type,
      TRACKELEMENT,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      region,
      ELEMENTS,
      newSwitch,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      CURRENTPOSITION,
      position,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      trackElementBefore,
      CONNECTS_TO,
      newSwitch,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitch,
      CONNECTS_TO,
      trackElementAfter,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitchPosition,
      RDF.type,
      SWITCHPOSITION,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitchPosition,
      POSITION,
      position,
    ));

    this.driver.streamingStore.addQuad(new Quad(
      newSwitchPosition,
      TARGET,
      newSwitch,
    ));
  }
}
