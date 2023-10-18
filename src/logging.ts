const prefix = "KibanaClicker";

export function log(msg: string, ...args: any[]) {
  const message = `${prefix}: ${msg}`;
  if (process.env.PLASMO_TAG === "prod") {
    console.debug(message, ...args);
  } else if (process.env.PLASMO_TAG === "dev") {
    console.log(message, ...args);
  }
}
