import type { Term } from 'n3';
import { DataFactory } from 'n3';
import { BASE_PREFIX } from './BenchmarkTerms';

export enum Positions {
  FAILURE,
  STRAIGHT,
  DIVERGING
}

export class Position {
  private value: Positions;

  public constructor(position: Term | string | Positions) {
    if (typeof position === 'string') {
      this.value = this.getPositionFromString(position);
      return;
    }
    if (typeof position === 'number') {
      this.value = position;
      return;
    }
    // 'http://www.semanticweb.org/ontologies/2015/trainbenchmark#POSITION_FAILURE'
    this.value = this.getPositionFromString(
      position.value.replace(`${BASE_PREFIX}POSITION_`, ''),
    );
  }

  public getPositionFromString(value: string): Positions {
    switch (value) {
      case 'FAILURE': return Positions.FAILURE;
      case 'STRAIGHT': return Positions.STRAIGHT;
      case 'DIVERGING': return Positions.DIVERGING;
      default: throw new Error(`Position: ${value} is not known!`);
    }
  }

  public incrementPosition(): void {
    this.value = (this.value + 1) % 3;
  }

  public toString(): string {
    switch (this.value) {
      case Positions.FAILURE: return 'FAILURE';
      case Positions.STRAIGHT: return 'STRAIGHT';
      case Positions.DIVERGING: return 'DIVERGING';
      default: throw new Error(`Position: ${this.value} is not known!`);
    }
  }

  public toTerm(): Term {
    return DataFactory.namedNode(`${BASE_PREFIX}POSITION_${this.toString()}`);
  }
}
