const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true }, // "challan"
        sequence_value: { type: Number, default: 0 },
    },
    { versionKey: false }
);

// ✅ Static method
counterSchema.statics.getNextSequence = async function (name, session) {
    const counter = await this.findOneAndUpdate(
        { _id: name },
        { $inc: { sequence_value: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session, // 🔒 transaction safe
        }
    );

    return counter.sequence_value;
};

module.exports = mongoose.model('challan_counter', counterSchema);
