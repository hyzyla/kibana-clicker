const prefix = "KibanaClicker";

export function log(msg: string, ...args: any[]) {
  const message = `${prefix}: ${msg}`;
  if (process.env.NODE_ENV === "production") {
    console.debug(message, ...args);
  } else {
    console.log(message, ...args);
  }
}
