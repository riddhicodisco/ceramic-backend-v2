module.exports = {
    FILES_FOLDER: {
        public: 'public',
        default: 'default',
        userImages: 'userImages',
        productImages: 'productImages',
    },

    ROLES: {
        // superAdmin: 'SuperAdmin',
        admin: 'Admin',
        subAdmin: 'Sub Admin',
        user: 'User',
        seller: 'Seller',
        // customer: 'Customer',
        // manager: 'Manager',
        reception: 'Reception',
        accountant: 'Accountant'
    },

    TOKEN_TYPES: {
        access: 'Access',
        refresh: 'Refresh',
        verifyOtp: 'VerifyOtp',
    },

    SOCIAL_TYPES: {
        google: 'Google',
        apple: 'Apple',
    },

    FILE_QUALITY: {
        large: { type: 'high', quality: 80 },
        small: { type: 'low', quality: 1 },
    },

    FILE_SIZE: {
        large: { type: 'large', size: [888, 595] },
        small: { type: 'small', size: [84, 48] },
    },

    SAMPLE_TYPES: {
        PANEL: 'Panel',
        CATALOG: 'Catalog',
    },

    REQUIREMENT_STATUS: {
        PENDING: 'Pending',
        FOLLOWUP: 'Follow Up',
        COMPLETED: 'Selection',
        CANCELLED: 'Cancelled',
    },

    SELECTION_STATUS: {
        PENDING: 'Pending',
        FOLLOWUP: 'Follow Up',
        CANCELLED: 'Cancelled',
        COMPLETED: 'Completed',
        DELIVERED: "Delivered"
    },

    FOLLOWUP_SELECTION_STATUS: {
        PENDING: 'Pending',
        FOLLOWUP: 'Follow Up',
        CANCELLED: 'Cancelled',
        COMPLETED: 'Completed',
        RESCHEDULED: 'Rescheduled',
    },

    FOLLOWUP_STATUS: {
        PENDING: 'Pending',
        RESCHEDULED: 'Rescheduled',
    },

    VERSION_TYPES: {
        config: 'config',
        ios: 'iOS',
        android: 'android',
    },
    CHALLAN_STATUS: {
        PENDING: 'Pending',
        COMPLETED: 'Completed',
        // DELIVERED: 'Delivered',
    },

    CUSTOMER_TYPE: {
        ALL: 'All',
        NEW: 'New',
        OLD: 'Old',
    },

};
