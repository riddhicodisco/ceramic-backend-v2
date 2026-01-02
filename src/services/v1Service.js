const axios = require('axios');
const config = require('../config/config');

class V1Service {
    constructor() {
        this.baseURL = config.base_url || 'http://localhost:5001';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Update product challan flag in v1
     * @param {string} productId - Product ID in v1
     * @param {boolean} isChallan - Challan flag value
     * @returns {Promise} - Axios response
     */
    async updateProductChallanFlag(productId, isChallan) {
        try {
            const response = await this.client.put(
                `/v1/admin/series-product/update-challan-flag/${productId}`,
                { isChallan }
            );
            return response.data;
        } catch (error) {
            // If v1 service is not available, log the error but don't fail the operation
            if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
                console.warn(`V1 service unavailable - could not update challan flag for product ${productId}. This is non-critical.`);
                return { success: false, message: 'V1 service unavailable' };
            }
            console.error('Error updating product challan flag in v1:', error.message);
            throw new Error(`Failed to update product in v1: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get product details from v1
     * @param {string} productId - Product ID in v1
     * @returns {Promise} - Axios response
     */
    async getProduct(productId) {
        try {
            const response = await this.client.get(`/v1/admin/series-product/get/${productId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting product from v1:', error.message);
            throw new Error(`Failed to get product from v1: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new V1Service();
