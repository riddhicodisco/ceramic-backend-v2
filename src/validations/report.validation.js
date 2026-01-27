const Joi = require('joi');

const getBalanceSheet = {
  query: Joi.object().keys({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
  }),
};

module.exports = {
  getBalanceSheet,
};

