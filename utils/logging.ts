const prefix = "KibanaClicker";

export function log(msg: string, ...args: unknown[]) {
  const message = `${prefix}: ${msg}`;
  if (import.meta.env.DEV) {
    console.log(message, ...args);
  }
}
