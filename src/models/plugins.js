const mongoose = require('mongoose');

/**
 * Plugin for toJSON
 */
const toJSON = (schema) => {
  let options;
  if (schema.options.toJSON) {
    options = schema.options.toJSON;
  }

  const toJSONOptions = options || {};
  schema.options.toJSON = Object.assign(toJSONOptions, {
    transform(doc, ret, options) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
};

/**
 * Plugin for pagination
 */
const paginate = (schema) => {
  schema.statics.paginate = async function (filter, options) {
    let sort = '';
    if (options.sort) {
      if (typeof options.sort === 'string') {
        sort = options.sort.split(',').join(' ');
      } else {
        sort = options.sort;
      }
    }

    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 10;
    const skip = (page - 1) * limit;

    const countPromise = this.countDocuments(filter).exec();
    let docsPromise = this.find(filter).sort(sort).skip(skip).limit(limit);

    if (options.populate) {
      options.populate.split(',').forEach((populateOption) => {
        docsPromise = docsPromise.populate(
          populateOption
            .split('.')
            .reverse()
            .reduce((a, b) => ({ path: b, populate: a }))
        );
      });
    }

    docsPromise = docsPromise.exec();

    return Promise.all([countPromise, docsPromise]).then(([totalResults, docs]) => {
      const totalPages = Math.ceil(totalResults / limit);
      const result = {
        results: docs,
        page,
        limit,
        totalPages,
        totalResults,
      };
      return result;
    });
  };
};

module.exports = {
  toJSON,
  paginate,
};
