import type { Bindings } from '@incremunica/incremental-types';
import { Quad } from '@incremunica/incremental-types';
import {
  CONNECTS_TO,
  CURRENTPOSITION,
  ELEMENTS,
  MONITORED_BY,
  RDF,
  SWITCH,
  TARGET,
  TRACKELEMENT,
} from '../../BenchmarkTerms';
import type { Driver } from '../../Driver';
import type { BenchmarkConfig } from '../../Types';
import { TransformationOperation } from '../TransformationOperation';

export class RepairCompleteStar extends TransformationOperation {
  public constructor(driver: Driver, config: BenchmarkConfig) {
    super(
      driver,
      config,
      `
PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?switch ?sensor ?region ?position ?trackElementBefore ?trackElementAfter ?switchPosition
WHERE {
    ?switch a base:Switch .
    ?switch base:monitoredBy ?sensor .
    ?region base:elements ?switch .
    ?switch base:currentPosition ?position .
    ?trackElementBefore base:connectsTo ?switch .
    ?switch base:connectsTo ?trackElementAfter .
    ?switchPosition base:target ?switch .
}
`,
      'repair complete star',
    );
  }

  protected _transform(bindings: Bindings): void {
    const switchElement = this.getSafe(bindings, 'switch');
    const sensor = this.getSafe(bindings, 'sensor');
    const region = this.getSafe(bindings, 'region');
    const position = this.getSafe(bindings, 'position');
    const trackElementBefore = this.getSafe(bindings, 'trackElementBefore');
    const trackElementAfter = this.getSafe(bindings, 'trackElementAfter');
    const switchPosition = this.getSafe(bindings, 'switchPosition');

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      RDF.type,
      SWITCH,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      MONITORED_BY,
      sensor,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      RDF.type,
      TRACKELEMENT,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      region,
      ELEMENTS,
      switchElement,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      CURRENTPOSITION,
      position,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      trackElementBefore,
      CONNECTS_TO,
      switchElement,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      switchElement,
      CONNECTS_TO,
      trackElementAfter,
    ));

    this.driver.streamingStore.removeQuad(new Quad(
      switchPosition,
      TARGET,
      switchElement,
    ));
  }
}
