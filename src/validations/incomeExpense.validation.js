const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createEntry = {
    body: Joi.object().keys({
        category: Joi.string().required(),
        amount: Joi.number().required(),
        remark: Joi.string().allow('').optional(),
        date: Joi.date().optional(),
        type: Joi.string().valid('income', 'expense').required(),
    }),
};

const getEntries = {
    query: Joi.object().keys({
        category: Joi.string(),
        type: Joi.string().valid('income', 'expense'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
        search: Joi.string().allow('').optional(),
    }),
};

module.exports = {
    createEntry,
    getEntries,
};
