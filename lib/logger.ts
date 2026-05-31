class LOGGER {
  static log(...args: unknown[]) {
    console.log("[Log]", ...args);
  }

  static error(...args: unknown[]) {
    console.error("[Error]", ...args);
  }

  static warn(...args: unknown[]) {
    console.warn("[Warn]", ...args);
  }

  static info(...args: unknown[]) {
    console.info("[Info]", ...args);
  }

  static debug(...args: unknown[]) {
    console.debug("[Debug]", ...args);
  }
}

const logger = LOGGER;

export default logger;
