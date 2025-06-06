
// Production Logger Service
class ProductionLogger {
  private logs: any[] = [];

  log(level: string, message: string, data?: any) {
    const logEntry = {
      id: Date.now(),
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.logs.push(logEntry);
    console.log(`📝 [${level.toUpperCase()}] ${message}`, data);
  }

  error(message: string, error?: any) {
    this.log('error', message, error);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }
}

export const productionLogger = new ProductionLogger();
