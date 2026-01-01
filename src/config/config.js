require('dotenv').config();

const config = {
  port: process.env.PORT || 5002,
  mongoose: {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017/ceramic-backend-v2',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  v1BaseUrl: process.env.V1_BASE_URL || 'http://localhost:5001',
};

module.exports = config;
