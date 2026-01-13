const config = require('../config/config');

class V1Service {
    constructor() {
        this.baseURL = config.v1BaseUrl || 'http://localhost:7005';

        if (!config.v1BaseUrl) {
            console.warn('⚠️ V1_BASE_URL not set in environment, using default: http://localhost:7005');
        }
    }

    /**
     * Update challan flag in V1 selection products using multiple update API
     * @param {Array} products - Array of products with selectionId and product details
     * @param {boolean} isChallan - Whether challan is created
     * @param {string} token - Authorization token
     * @param {string} challanId - Challan ID
     * @returns {Promise} - Fetch response
     */
    async updateMultipleProductChallanFlags(products, isChallan, token, challanId = null, challanNumber = null, challanStatus = null) {
        try {
            const headers = {
                'Content-Type': 'application/json',
            };

            if (token) headers.Authorization = token;

            // Group products by selectionId
            const updatesBySelection = {};

            products.forEach(product => {
                const selectionId = product.selectionId;
                if (!selectionId) {
                    console.warn('⚠️ Product missing selectionId, skipping:', product);
                    return;
                }

                if (!updatesBySelection[selectionId]) {
                    updatesBySelection[selectionId] = {
                        selectionId: selectionId,
                        productVariantId: []
                    };
                }

                // Create product object with isChallan flag as per V1 API structure
                const productObject = {
                    p_id: product.selectionProductId || product._id, // Product ID
                    totalSquareFeet: product.totalSquareFeet || 0,
                    totalBox: product.totalBox || 0,
                    unitPerPrice: product.unitPerPrice || product.price || 0,
                    unit: product.unit || '',
                    isChallan: isChallan || false,
                    challanId: challanId,
                    challanCreated: isChallan || false,
                    challanNumber: challanNumber,
                    challanStatus: challanStatus || (isChallan ? 'Pending' : null)
                };

                updatesBySelection[selectionId].productVariantId.push(productObject);
            });

            const updates = Object.values(updatesBySelection);

            const requestBody = { updates };

            const response = await fetch(`${this.baseURL}/v1/mobile/staff/selection/update-multiple-challan-flags`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();


            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            // If v1 service is not available, log error but don't fail the operation
            if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
                return { success: false, message: 'V1 service unavailable' };
            }
            if (error.message.includes('401')) {
                return { success: false, message: 'Authentication failed' };
            }
            if (error.message.includes('403')) {
                return { success: false, message: 'Permission denied' };
            }
            if (error.message.includes('404')) {
                return { success: false, message: 'Selection products not found' };
            }
            throw new Error(`Failed to update products in v1: ${error.message}`);
        }
    }

    /**
     * Get product details from v1
     * @param {string} productId - Product ID in v1
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getProduct(productId, token = null) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/series-product/get/${productId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('Error getting product from v1:', error.message);
            throw new Error(`Failed to get product from v1: ${error.message}`);
        }
    }

    /**
     * Get customer details from v1
     * @param {string} customerId - Customer ID in v1
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getCustomer(customerId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/staff/customer-details/${customerId}`, { headers });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting customer from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get customer from v1: ${error.message}`);
        }
    }

    /**
     * Get selection details from v1
     * @param {string} selectionId - Selection ID in v1
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getSelection(selectionId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/selection/get/${selectionId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting selection from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get selection from v1: ${error.message}`);
        }
    }

    /**
     * Get role details from v1
     * @param {string} roleId - Role ID
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getRole(roleId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/role/get/${roleId}`, { headers });
            const data = await response.json();
console.log(data ,'data-----------------')
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            if (error.message.includes('404')) {
                console.warn('V1 Role returned 404');
                return null;
            }
            // Non-blocking error for role lookup if service is down, but likely critical for auth
            return null;
        }
    }

    /**
     * Get selection product details from v1
     * @param {string} selectionProductId - Selection Product ID
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getSelectionProduct(selectionProductId, token) {
        try {
            const headers = {};
            if (token) {
                headers.Authorization = token;
            }

            const url = `${this.baseURL}/v1/admin/selection-product/get/${selectionProductId}`;

            const response = await fetch(url, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting selection product from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get selection product from v1: ${error.message}`);
        }
    }

    /**
     * Get series product details from v1
     * @param {string} seriesProductId - Series Product ID
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getSeriesProduct(seriesProductId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/series-product/get/${seriesProductId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            // Populate series details if series reference exists
            if (data?.data?.series && token) {
                try {
                    const seriesData = await this.getSeries(data.data.series.toString(), token);
                    if (seriesData) {
                        data.data.series_name = seriesData.series_name;
                    }
                } catch (error) {
                    console.warn('Could not fetch series data for series product:', error.message);
                }
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting series product from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get series product from v1: ${error.message}`);
        }
    }

    /**
     * Get series details from v1
     * @param {string} seriesId - Series ID
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getSeries(seriesId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/series/get/${seriesId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting series from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get series from v1: ${error.message}`);
        }
    }

    /**
     * Get vendor details from v1
     * @param {string} vendorId - Vendor ID in v1
     * @param {string} [token] - Authorization token
     * @returns {Promise} - Fetch response
     */
    async getVendor(vendorId, token) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/vendor/get/${vendorId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting vendor from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            throw new Error(`Failed to get vendor from v1: ${error.message}`);
        }
    }

    /**
     * Get user details from v1
     * @param {string} userId - User ID in v1
     * @param {string} [token] - Authorization token (optional)
     * @returns {Promise} - Fetch response
     */
    async getUser(userId, token = null) {
        try {
            const headers = {};
            if (token) headers.Authorization = token;

            const response = await fetch(`${this.baseURL}/v1/admin/user/get/${userId}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('User not found in v1:', userId);
                    return null;
                }
                if (response.status === 401) {
                    console.log('Authentication failed for v1 user API');
                    return null;
                }
                if (response.status === 403) {
                    console.log('Permission denied for v1 user API');
                    return null;
                }
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data?.data;
        } catch (error) {
            console.error('Error getting user from v1:', error.message);
            if (error.message.includes('404')) {
                return null;
            }
            if (error.message.includes('401') || error.message.includes('403')) {
                console.log('Authentication/Permission error for v1 user API');
                return null;
            }
            throw new Error(`Failed to get user from v1: ${error.message}`);
        }
    }
}

module.exports = new V1Service();
