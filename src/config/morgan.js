const morgan = require('morgan');
const config = require('./config');
const logger = require('./logger');

// morgan.token('error', (req, res) => res?.error || '');

const getIpFormat = () => (config.env === 'production' ? ':remote-addr - ' : '');
const successResponseFormat = `${getIpFormat()}:method [:status] :url - :response-time ms`;
const errorResponseFormat = `${getIpFormat()}:method [:status] :url  - :response-time ms`;

const successHandler = morgan(successResponseFormat, {
    skip: (req, res) => res.statusCode >= 400,
    stream: { write: (message) => logger.info(message.trim()) },
});

const errorHandler = morgan(errorResponseFormat, {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: (message) => logger.error(message.trim()) },
});

module.exports = {
    successHandler,
    errorHandler,
};
