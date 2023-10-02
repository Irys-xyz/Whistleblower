export class BatchInserter {
  protected buffer: any[] = [];
  protected sink: BatchSink;
  protected bufferSize: number;

  constructor({ sink, bufferSize }: { sink: BatchSink; bufferSize?: number }) {
    this.sink = sink;
    this.bufferSize = bufferSize ?? 100;
    process.on("beforeExit", () => this.flush());
    process.on("SIGINT", () => this.flush());
  }

  async push(items: any | any[]): Promise<void> {
    Array.isArray(items) ? this.buffer.push(...items) : this.buffer.push(items);
    if (this.buffer.length >= this.bufferSize) await this.flush();
  }

  async flush(): Promise<void> {
    const b = [...this.buffer];
    if (b.length === 0) return;
    this.buffer = [];
    await this.sink(b);
  }
}

export type BatchSink<T extends any[] = any[], R = any> = (items: T) => Promise<R>;
