const axios = require('axios');
const config = require('../config/config');

class V1AuthService {
    constructor() {
        this.baseURL = config.v1BaseUrl || 'http://localhost:7005';
        console.log('🔧 V1 Service Base URL:', this.baseURL);
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Get user from v1 by email
     */
    async getUserByEmail(email) {
        try {
            console.log('🔧 Getting user by email from v1:', email);
            const response = await this.client.post('/v1/auth/login', { email });
            console.log('🔧 V1 response status:', response.status);
            console.log('🔧 V1 response data:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Error getting user from v1:', error.message);
            console.error('❌ V1 error response:', error.response?.data);
            throw new Error(`Failed to get user from v1: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get user from v1 by ID
     */
    async getUserById(userId) {
        try {
            console.log('🔧 Getting user by ID from v1:', userId);
            const response = await this.client.get(`/v1/admin/users/${userId}`);
            console.log('🔧 V1 user by ID response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Error getting user by ID from v1:', error.message);
            console.error('❌ V1 error response:', error.response?.data);
            throw new Error(`Failed to get user by ID from v1: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Validate user credentials with v1
     */
    async validateCredentials(email, password) {
        try {
            const response = await this.client.post('/v1/auth/login', { email, password });
            return response.data;
        } catch (error) {
            console.error('Error validating credentials with v1:', error.message);
            throw new Error(`Invalid credentials: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get user permissions from v1
     */
    async getUserPermissions(userId) {
        try {
            console.log('🔧 Getting user permissions from v1:', userId);
            const response = await this.client.get(`/v1/admin/users/${userId}/permissions`);
            console.log('🔧 V1 permissions response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Error getting user permissions from v1:', error.message);
            console.error('❌ V1 permissions error response:', error.response?.data);
            return []; // Return empty array if no permissions
        }
    }

    /**
     * Get user role from v1
     */
    async getUserRole(userId) {
        try {
            const response = await this.client.get(`/v1/admin/users/${userId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting user role from v1:', error.message);
            throw new Error(`Failed to get user role: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new V1AuthService();
