import { Injectable } from '@nestjs/common';

interface Latch {
  readonly promise: Promise<void>;
  readonly release: () => void;
}

function createLatch(): Latch {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
}

@Injectable()
export class ProbeGate {
  private arrived = createLatch();
  private opened = createLatch();

  constructor() {
    this.opened.release();
  }

  close(): void {
    this.arrived = createLatch();
    this.opened = createLatch();
  }

  open(): void {
    this.opened.release();
  }

  arrival(): Promise<void> {
    return this.arrived.promise;
  }

  async pass(): Promise<void> {
    this.arrived.release();
    await this.opened.promise;
  }
}
