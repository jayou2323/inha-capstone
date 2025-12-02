declare module 'i2c-bus' {
  export interface I2cBus {
    closeSync(): void;
    i2cWrite(
      addr: number,
      length: number,
      buffer: Buffer,
      cb: (err: Error | null, bytesWritten: number, buf: Buffer) => void
    ): void;
    i2cRead(
      addr: number,
      length: number,
      buffer: Buffer,
      cb: (err: Error | null, bytesRead: number, buf: Buffer) => void
    ): void;
  }

  export function openSync(busNumber: number): I2cBus;
}


