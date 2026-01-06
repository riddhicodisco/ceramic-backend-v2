const express = require('express');
const { login, refreshToken, logout } = require('../../controllers/authController');

const router = express.Router();

/**
 * POST /v1/auth/login
 * Login user
 */
router.post('/login', login);

/**
 * POST /v1/auth/refresh-token
 * Refresh access token
 */
router.post('/refresh-token', refreshToken);

/**
 * POST /v1/auth/logout
 * Logout user
 */
router.post('/logout', logout);

module.exports = router;
