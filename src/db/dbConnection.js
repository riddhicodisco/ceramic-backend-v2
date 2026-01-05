const mongoose = require('mongoose');
const config = require('../config/config');

module.exports = connectDB = async () => {
    try {
        await mongoose.connect(config.mongoose.url, {
            useNewUrlParser: true,
            autoIndex: true,
            useUnifiedTopology: true,
        }); // Database connected.
        console.log('✅ V2 Database Connected successfully...');
    } catch (error) {
        console.log('❌ V2 Database Connections Error :', error);
        process.exit(1);
    }
}
