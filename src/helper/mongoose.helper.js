module.exports = {
    /**
     * Pagination query
     * @param {Object} options
     * @param {string} [options.sortBy] - Sorting criteria using the format: sortField:(desc|asc). Multiple sorting criteria should be separated by commas (,)
     * @param {number} [options.limit] - Maximum number of results per page (default = 10)
     * @param {number} [options.page] - Current page (default = 1)
     * @param {number} [options.page] - Current page (default = 1)
     * @param {Array} stages
     * @returns
     */
    paginationQuery: (options, stages = []) => {
        let { page, limit, sortBy } = options;

        page = page ? +page : 1;
        limit = limit ? +limit : 10;

        const sort = {};
        if (sortBy) {
            sortBy.split(',').forEach((sortOption) => {
                const [key, order] = sortOption.split(':');
                sort[key] = order === 'desc' ? -1 : 1;
            });
        } else sort._id = -1;

        const query = [
            {
                $sort: sort,
            },
            {
                $facet: {
                    pagination: [
                        {
                            $count: 'totalResults',
                        },
                        {
                            $addFields: {
                                page,
                                limit,
                                totalPages: {
                                    $ceil: {
                                        $divide: ['$totalResults', limit],
                                    },
                                },
                            },
                        },
                    ],
                    data: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...stages],
                },
            },
            {
                $unwind: {
                    path: '$pagination',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            {
                                results: '$data',
                            },
                            '$pagination',
                        ],
                    },
                },
            },
            {
                $unwind: {
                    path: '$pagination',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ];

        return query;
    },
};

