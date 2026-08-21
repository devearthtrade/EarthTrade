/**
 * Connection pool.
 *
 * Connections are expensive to open (a TCP handshake plus SCRAM) and the build
 * runs hundreds of queries, so they are reused. The pool is deliberately plain:
 * lazy creation up to a limit, a FIFO queue of waiters, and no idle reaping —
 * a build process is short-lived and closes the pool when it finishes.
 */

import { Connection, type ConnectOptions } from "./protocol.ts";

export class Pool {
  private readonly options: ConnectOptions;
  private readonly limit: number;
  private readonly idle: Connection[] = [];
  private readonly waiting: ((c: Connection) => void)[] = [];
  private open = 0;
  private closed = false;

  constructor(options: ConnectOptions, limit: number) {
    this.options = options;
    this.limit = limit;
  }

  private async acquire(): Promise<Connection> {
    if (this.closed) throw new Error("pool is closed");

    const free = this.idle.pop();
    if (free) return free;

    if (this.open < this.limit) {
      this.open++;
      try {
        const conn = new Connection(this.options);
        await conn.connect();
        return conn;
      } catch (err) {
        this.open--;
        throw err;
      }
    }

    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release(conn: Connection): void {
    const next = this.waiting.shift();
    if (next) next(conn);
    else this.idle.push(conn);
  }

  /**
   * Borrows a connection for the duration of `fn`. The connection returns to
   * the pool whether `fn` succeeds or throws, so a failing query cannot leak
   * one and starve the rest of the build.
   */
  async use<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    const conn = await this.acquire();
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const all = this.idle.splice(0);
    this.open -= all.length;
    await Promise.all(all.map((c) => c.end()));
  }
}
