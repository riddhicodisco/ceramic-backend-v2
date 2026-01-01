# Ceramic Backend V2 - Challan Module

This is the V2 backend for Ceramic project, specifically handling the Challan module.

## Overview

- **V1 Backend**: Handles products and existing functionality (Port 5001)
- **V2 Backend**: Handles challan module only (Port 5002)
- **Communication**: V2 calls V1 APIs to update product flags

## Features

- Challan CRUD operations
- Automatic product flag updates in V1
- Separate databases for V1 and V2
- Clean API communication between services

## Setup

1. Copy `.env.example` to `.env` and configure:
   ```bash
   PORT=5002
   MONGO_URI=your_mongo_url
   V1_BASE_URL=http://localhost:5001
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Challans
- `POST /v1/api/challans` - Create new challan
- `GET /v1/api/challans` - Get all challans
- `GET /v1/api/challans/:id` - Get single challan
- `PUT /v1/api/challans/:id` - Update challan
- `DELETE /v1/api/challans/:id` - Delete challan

## How It Works

### Create Challan
1. V2 receives challan creation request
2. V2 saves challan in V2 database
3. V2 calls V1 API: `PUT /v1/product/update-challan-flag/:productId`
4. V1 updates product `isChallan = true`

### Delete Challan
1. V2 receives challan deletion request
2. V2 deletes challan from V2 database
3. V2 calls V1 API: `PUT /v1/product/update-challan-flag/:productId`
4. V1 updates product `isChallan = false`

## Database Schema

### Challan Model (V2)
```javascript
{
  productId: ObjectId,  // Reference to V1 product
  qty: Number,
  createdAt: Date,
  deletedAt: Date
}
```

### Product Variant Model (V1)
```javascript
{
  // ... existing fields
  isChallan: Boolean,  // New field added
  default: false
}
```

## Environment Variables

- `PORT`: Server port (default: 5002)
- `MONGO_URI`: MongoDB connection string
- `V1_BASE_URL`: V1 backend URL (default: http://localhost:5001)

## Dependencies

- **axios**: For API calls to V1
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **joi**: Validation
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing