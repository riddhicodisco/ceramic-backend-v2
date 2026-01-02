const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const path = require('path');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/apiError');
const i18next = require('./middlewares/i18next');
const { FILES_FOLDER } = require('./helper/constant.helper');
const runCron = require('./services/cron.service');
const MESSAGE = require('./config/message.json');
// require('./utils/cronManage'); // Uncomment if execute the cron

const app = express();

app.use(morgan.successHandler);
app.use(morgan.errorHandler);

// Localization
app.use(i18next);

app.use(express.static(path.join(__dirname, `../${FILES_FOLDER.public}`)));

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());
// app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '100MB' }))

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
// app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request

app.use((req, res, next) => {
    next(new ApiError(httpStatus.NOT_FOUND, MESSAGE.route_not_found));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

// Cron
// runCron();

module.exports = app;
