const mongoose = require('mongoose');

// Define the schema
const allContractsSchema = new mongoose.Schema({
    category: { type: String, required: true, index: true  },
    shareToken: {
        type: String,
        required: false,
    },
    shareTokenCreatedAt: Date,
    fileHash: { type: String, unique: true, required: true },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Expired', 'Extension', 'Support', 'Terminated', 'Archived'],
        default: 'Active',
        index: true 
    },
    renewedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    attachments: [{
        fileName: String,
        filePath: String,
        fileSize: Number,
        uploadDate: { type: Date, default: Date.now }
    }],
    renewal: { type: Boolean, default: false },
}, {
    timestamps: true, // Adds `createdAt` and `updatedAt` fields
    strict: false
});

// Add new indexes for optimization
allContractsSchema.index({ endDate: 1, startDate: 1 });
allContractsSchema.index({ fileHash: 1 });

// Create the model
const AllContracts = mongoose.model('AllContracts', allContractsSchema);

// Export the model
module.exports = AllContracts;
