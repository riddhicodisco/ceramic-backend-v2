const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { purchaseOrderService } = require('../../services/commonServices');
const v1Service = require('../../services/v1Service');

module.exports = {
  /**
   * Get vendors with purchase order count
   * Similar to getCustomersWithChallans in challan.controller.js
   */
  getVendorsWithPurchaseOrders: catchAsync(async (req, res) => {
    const { search } = req.query;
    const token = req.headers.authorization;

    // Aggregate purchase orders by vendor from V2 database
    const pipeline = [
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$vendor',
          poCount: { $sum: 1 },
          lastPoDate: { $max: '$createdAt' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { lastPoDate: -1 } }
    ];

    const aggregatedVendors = await purchaseOrderService.aggregate(pipeline);

    if (!aggregatedVendors || aggregatedVendors.length === 0) {
      return res.status(httpStatus.OK).send({
        success: true,
        message: 'No vendors with purchase orders found',
        data: [],
      });
    }

    // Fetch vendor details from V1
    const vendorsWithDetails = [];
    await Promise.all(aggregatedVendors.map(async (item) => {
      try {
        if (!item._id) return;
        const vendor = await v1Service.getVendor(item._id.toString(), token);

        // Filter by search if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const vendorName = (vendor?.vendorName || '').toLowerCase();
          const phone = vendor?.phone || '';

          if (!vendorName.includes(searchLower) && !phone.includes(searchLower)) {
            return;
          }
        }

        if (vendor) {
          vendorsWithDetails.push({
            ...vendor,
            poCount: item.poCount,
            lastPoDate: item.lastPoDate,
            totalPurchaseAmount: item.totalAmount
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch vendor ${item._id} from V1`);
      }
    }));

    // Sort again by last PO date
    vendorsWithDetails.sort((a, b) => new Date(b.lastPoDate) - new Date(a.lastPoDate));

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Vendors with purchase orders fetched successfully',
      data: vendorsWithDetails,
    });
  }),

  /**
   * Get purchase orders for specific vendor with filters
   */
  getVendorPurchaseOrders: catchAsync(async (req, res) => {
    const { vendorId } = req.params;
    const { page = 1, limit = 10, startDate, endDate, minAmount, maxAmount, challanNumber, status } = req.query;
    const token = req.headers.authorization;

    // Verify vendor exists in V1
    const vendor = await v1Service.getVendor(vendorId, token);
    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found (in V1)');
    }

    const filter = {
      deletedAt: null,
      vendor: vendorId,
    };

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // End of day
        filter.createdAt.$lte = endDateTime;
      }
    }

    // Amount range filter
    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.totalAmount = {};
      if (minAmount !== undefined) {
        filter.totalAmount.$gte = parseFloat(minAmount);
      }
      if (maxAmount !== undefined) {
        filter.totalAmount.$lte = parseFloat(maxAmount);
      }
    }

    // Challan number filter
    if (challanNumber) {
      filter.challan = { $regex: challanNumber, $options: 'i' };
    }

    // Status filter
    if (status && status !== 'All') {
      filter.status = status;
    }

    // Use paginate for easier count and page management
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    const purchaseOrdersResult = await purchaseOrderService.getAll(filter, options);

    if (!purchaseOrdersResult || purchaseOrdersResult.results.length === 0) {
      return res.status(httpStatus.OK).send({
        success: true,
        message: 'Purchase orders fetched successfully',
        data: {
          results: [],
          page: purchaseOrdersResult?.page || 1,
          limit: purchaseOrdersResult?.limit || 10,
          totalPages: purchaseOrdersResult?.totalPages || 0,
          totalResults: purchaseOrdersResult?.totalResults || 0,
          vendor: vendor,
        },
      });
    }

    const purchaseOrders = purchaseOrdersResult.results;

    // Enrich with vendor details
    const enrichedResults = purchaseOrders.map(po => {
      const poObj = po.toObject ? po.toObject() : { ...po };
      poObj.vendor = vendor;
      poObj.vendorDetails = vendor;
      return poObj;
    });

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase orders fetched successfully',
      data: {
        results: enrichedResults,
        page: purchaseOrdersResult.page,
        limit: purchaseOrdersResult.limit,
        totalPages: purchaseOrdersResult.totalPages,
        totalResults: purchaseOrdersResult.totalResults,
        vendor: vendor,
      },
    });
  }),
};
