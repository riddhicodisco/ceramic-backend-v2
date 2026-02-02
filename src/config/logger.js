const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
    if (info instanceof Error) {
        Object.assign(info, { message: info.stack });
    }
    return info;
});

// Create logs directory path
const logsDir = path.join(__dirname, '../../logs');

// Error log format (JSON for structured logging)
const errorLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Console format (human-readable)
const consoleFormat = winston.format.combine(
    enumerateErrorFormat(),
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message, timestamp }) => {
        return timestamp ? `${timestamp} ${level}: ${message}` : `${level}: ${message}`;
    })
);

// Daily rotate file transport for errors only
const errorFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'errors', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: errorLogFormat,
    maxSize: '20m',
    maxFiles: '7d', // Keep 7 days of error logs
    zippedArchive: true, // Compress old log files
    handleExceptions: true,
    handleRejections: true,
});

const logger = winston.createLogger({
    level: config.env === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true })
    ),
    transports: [
        // Console transport (for all levels)
        new winston.transports.Console({
            format: consoleFormat,
            stderrLevels: ['error'],
        }),
        // Error file transport (errors only)
        errorFileTransport,
    ],
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: [
        errorFileTransport,
        new winston.transports.Console({ format: consoleFormat }),
    ],
    rejectionHandlers: [
        errorFileTransport,
        new winston.transports.Console({ format: consoleFormat }),
    ],
});

module.exports = logger;
