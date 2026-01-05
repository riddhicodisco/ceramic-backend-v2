const mongoose = require('mongoose');
const ChallanCounter = require('../models/challanCounter.model');

const generateChallanWithTransaction = async (selectionId) => {
    const session = await mongoose.startSession();
    let challanNumber;

    try {
        await session.withTransaction(async () => {
            // 🔒 Step 1: Generate next challan sequence
            const sequenceNumber = await ChallanCounter.getNextSequence(
                'challan',
                session
            );

            // 🔢 Step 2: Format as INV-000001 (6-digit sequence)
            challanNumber = `INV-${String(sequenceNumber).padStart(6, '0')}`;

            // 🔒 Step 3: Assign to selection
            const result = await mongoose.connection
                .collection('selections')
                .updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(selectionId),
                        challanNumber: null,
                    },
                    {
                        $set: { challanNumber },
                    },
                    { session }
                );

            if (result.matchedCount === 0) {
                throw new Error('Challan already assigned');
            }
        });

        return challanNumber;
    } finally {
        await session.endSession();
    }
};

module.exports = { generateChallanWithTransaction };
