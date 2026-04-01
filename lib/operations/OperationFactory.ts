import type { Driver } from '../Driver';
import type { BenchmarkConfig } from '../Types';
import { BatchConnectedSegments } from './batch/BatchConnectedSegments';
import { BatchOperation } from './batch/BatchOperation';
import { BatchPosLength } from './batch/BatchPosLength';
import { BatchRouteSensor } from './batch/BatchRouteSensor';
import { BatchSemaphoreNeighbor } from './batch/BatchSemaphoreNeighbor';
import { BatchSwitchMonitored } from './batch/BatchSwitchMonitored';
import { BatchSwitchSet } from './batch/BatchSwitchSet';
import { InjectCartesian } from './inject/InjectCartesian';
import { InjectChain } from './inject/InjectChain';
import { InjectCompleteStar } from './inject/InjectCompleteStar';
import { InjectConnectedSegments } from './inject/InjectConnectedSegments';
import { InjectConnectedSegmentsFull } from './inject/InjectConnectedSegmentsFull';
import { InjectPosLength } from './inject/InjectPosLength';
import { InjectRouteSensor } from './inject/InjectRouteSensor';
import { InjectSemaphoreNeighbor } from './inject/InjectSemaphoreNeighbor';
import { InjectStar } from './inject/InjectStar';
import { InjectSwitchMonitored } from './inject/InjectSwitchMonitored';
import { InjectSwitchSet } from './inject/InjectSwitchSet';
import type { Operation } from './Operation';
import { RepairCartesian } from './repair/RepairCartesian';
import { RepairChain } from './repair/RepairChain';
import { RepairCompleteStar } from './repair/RepairCompleteStar';
import { RepairConnectedSegments } from './repair/RepairConnectedSegments';
import { RepairPosLength } from './repair/RepairPosLength';
import { RepairRouteSensor } from './repair/RepairRouteSensor';
import { RepairSemaphoreNeighbor } from './repair/RepairSemaphoreNeighbor';
import { RepairStar } from './repair/RepairStar';
import { RepairSwitchMonitored } from './repair/RepairSwitchMonitored';
import { RepairSwitchSet } from './repair/RepairSwitchSet';

export const OperationFactory = {
  create(operationString: string, driver: Driver, config: BenchmarkConfig): Operation {
    const match = operationString.match(/\d+/ug);
    let size = 0;
    if (match) {
      size = Number.parseInt(match[0], 10);
    }
    operationString = operationString.replace(/\d+/ug, '');
    switch (operationString) {
      // Batch
      case 'BatchConnectedSegments': {
        return new BatchConnectedSegments(driver, config);
      }
      case 'BatchPosLength': {
        return new BatchPosLength(driver, config);
      }
      case 'BatchRouteSensor': {
        return new BatchRouteSensor(driver, config);
      }
      case 'BatchSemaphoreNeighbor': {
        return new BatchSemaphoreNeighbor(driver, config);
      }
      case 'BatchSwitchMonitored': {
        return new BatchSwitchMonitored(driver, config);
      }
      case 'BatchSwitchSet': {
        return new BatchSwitchSet(driver, config);
      }
      case 'BatchChain': {
        let queryString = 'PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>\n';
        queryString += 'PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n';
        queryString += 'SELECT ?switch ';

        for (let i = 1; i < size; i++) {
          queryString += `?segment${i} `;
        }

        queryString += 'WHERE\n{\n';
        queryString += `?switch a base:Switch .\n`;
        queryString += `?switch base:connectsTo ?segment1 .\n`;

        for (let i = 1; i < size - 1; i++) {
          queryString += `?segment${i} base:connectsTo ?segment${i + 1} .\n`;
        }

        queryString += `}`;

        return new BatchOperation(
          driver,
          config,
          queryString,
          `batch chain ${size}`,
        );
      }
      case 'BatchStar': {
        let queryStringSelect = 'PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>\n';
        queryStringSelect += 'PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n';
        queryStringSelect += 'SELECT ?switch ';
        let queryStringBody = 'WHERE\n{\n';

        queryStringBody += '?switch a base:Switch .\n';

        if (size === 0) {
          throw new Error('Star size not supported');
        }
        if (size >= 2) {
          queryStringSelect += '?sensor ';
          queryStringBody += `?switch base:monitoredBy ?sensor .\n`;
        }
        if (size >= 3) {
          queryStringBody += '?switch a base:TrackElement .\n';
        }
        if (size >= 4) {
          queryStringSelect += '?region ';
          queryStringBody += `?region base:elements ?switch .\n`;
        }
        if (size >= 5) {
          queryStringSelect += '?position ';
          queryStringBody += `?switch base:currentPosition ?position .\n`;
        }
        if (size >= 6) {
          queryStringSelect += '?trackElementBefore ';
          queryStringBody += `?trackElementBefore base:connectsTo ?switch .\n`;
        }
        if (size >= 7) {
          queryStringSelect += '?trackElementAfter ';
          queryStringBody += `?switch base:connectsTo ?trackElementAfter .\n`;
        }
        if (size >= 8) {
          queryStringSelect += '?switchPosition ';
          queryStringBody += `?switchPosition base:target ?switch .\n`;
        }
        if (size >= 9) {
          throw new Error('Star size not supported');
        }

        queryStringBody += `\n}`;

        return new BatchOperation(
          driver,
          config,
          queryStringSelect + queryStringBody,
          `batch star ${size}`,
        );
      }
      case 'BatchStarLast': {
        let queryStringSelect = 'PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>\n';
        queryStringSelect += 'PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n';
        queryStringSelect += 'SELECT ?switch ';
        let queryStringBody = 'WHERE\n{\n';

        queryStringBody += '?switch a base:Switch .\n';

        if (size === 0 || size === 1) {
          throw new Error('Star size not supported');
        }
        if (size >= 3) {
          queryStringBody += '?switch a base:TrackElement .\n';
        }
        if (size >= 4) {
          queryStringSelect += '?region ';
          queryStringBody += `?region base:elements ?switch .\n`;
        }
        if (size >= 5) {
          queryStringSelect += '?position ';
          queryStringBody += `?switch base:currentPosition ?position .\n`;
        }
        if (size >= 6) {
          queryStringSelect += '?trackElementBefore ';
          queryStringBody += `?trackElementBefore base:connectsTo ?switch .\n`;
        }
        if (size >= 7) {
          queryStringSelect += '?trackElementAfter ';
          queryStringBody += `?switch base:connectsTo ?trackElementAfter .\n`;
        }
        if (size >= 8) {
          queryStringSelect += '?switchPosition ';
          queryStringBody += `?switchPosition base:target ?switch .\n`;
        }
        if (size >= 9) {
          throw new Error('Star size not supported');
        }
        queryStringSelect += '?sensor ';
        queryStringBody += `?switch base:monitoredBy ?sensor .\n`;

        queryStringBody += `\n}`;

        return new BatchOperation(
          driver,
          config,
          queryStringSelect + queryStringBody,
          `batch star ${size}`,
        );
      }
      case 'BatchCartesian': {
        let queryStringSelect = 'PREFIX base: <http://www.semanticweb.org/ontologies/2015/trainbenchmark#>\n';
        queryStringSelect += 'PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n';
        queryStringSelect += 'SELECT ?switch ?position ';
        let queryStringBody = 'WHERE\n{\n';

        queryStringBody += `?switch base:currentPosition ?position .\n`;
        if (size === 0) {
          throw new Error('Star size not supported');
        }
        if (size >= 2) {
          queryStringSelect += `?route1 ?active `;
          queryStringBody += `?route1 base:active ?active .\n`;
        }
        if (size >= 3) {
          queryStringSelect += `?route2 ?entry `;
          queryStringBody += '?route2 base:entry ?entry .\n';
        }
        if (size >= 4) {
          queryStringSelect += `?route3 ?exit `;
          queryStringBody += '?route3 base:exit ?exit .\n';
        }

        queryStringBody += `\n}`;

        return new BatchOperation(
          driver,
          config,
          queryStringSelect + queryStringBody,
          `batch cartesian ${size}`,
        );
      }
      // Inject
      case 'InjectConnectedSegments': {
        return new InjectConnectedSegments(driver, config);
      }
      case 'InjectConnectedSegmentsFull': {
        return new InjectConnectedSegmentsFull(driver, config);
      }
      case 'InjectPosLength': {
        return new InjectPosLength(driver, config);
      }
      case 'InjectRouteSensor': {
        return new InjectRouteSensor(driver, config);
      }
      case 'InjectSemaphoreNeighbor': {
        return new InjectSemaphoreNeighbor(driver, config);
      }
      case 'InjectSwitchMonitored': {
        return new InjectSwitchMonitored(driver, config);
      }
      case 'InjectSwitchSet': {
        return new InjectSwitchSet(driver, config);
      }
      case 'InjectChain': {
        // Return new InjectConnectedSegments(driver, config);
        return new InjectChain(driver, config);
      }
      case 'InjectStar': {
        // Return new InjectConnectedSegmentsFull(driver, config);
        return new InjectStar(driver, config);
      }
      case 'InjectCompleteStar': {
        return new InjectCompleteStar(driver, config);
      }
      case 'InjectCartesian': {
        // Return new InjectSwitchSet(driver, config);
        return new InjectCartesian(driver, config);
      }
      // Repair
      case 'RepairConnectedSegments': {
        return new RepairConnectedSegments(driver, config);
      }
      case 'RepairPosLength': {
        return new RepairPosLength(driver, config);
      }
      case 'RepairRouteSensor': {
        return new RepairRouteSensor(driver, config);
      }
      case 'RepairSemaphoreNeighbor': {
        return new RepairSemaphoreNeighbor(driver, config);
      }
      case 'RepairSwitchMonitored': {
        return new RepairSwitchMonitored(driver, config);
      }
      case 'RepairSwitchSet': {
        return new RepairSwitchSet(driver, config);
      }
      case 'RepairChain': {
        // Return new RepairConnectedSegments(driver, config);
        return new RepairChain(driver, config);
      }
      case 'RepairStar': {
        // Return new RepairSegmentForSensor(driver, config);
        return new RepairStar(driver, config);
      }
      case 'RepairCompleteStar': {
        return new RepairCompleteStar(driver, config);
      }
      case 'RepairCartesian': {
        // Return new RepairSwitchSet(driver, config);
        return new RepairCartesian(driver, config);
      }
    }
    throw new Error(`No cases matched ${operationString}`);
  },
};
