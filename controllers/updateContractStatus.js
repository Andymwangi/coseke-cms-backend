const AllContracts = require('../models/AllContracts');

async function updateContractStatus() {
    try {
        const currentDate = new Date();
        const oneYearAgo = new Date(currentDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const pipeline = [
            {
                $match: {
                    $or: [
                        { status: { $ne: "Active" }, startDate: { $lte: currentDate }, endDate: { $gte: currentDate } },
                        { status: { $ne: "Expired" }, endDate: { $lt: currentDate, $gte: oneYearAgo } },
                        { status: { $ne: "Archived" }, endDate: { $lt: oneYearAgo } }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    newStatus: {
                        $switch: {
                            branches: [
                                { case: { $and: [{ $lte: ["$startDate", currentDate] }, { $gte: ["$endDate", currentDate] }] }, then: "Active" },
                                { case: { $and: [{ $lt: ["$endDate", currentDate] }, { $gte: ["$endDate", oneYearAgo] }] }, then: "Expired" },
                                { case: { $lt: ["$endDate", oneYearAgo] }, then: "Archived" }
                            ],
                            default: "$status"
                        }
                    }
                }
            }
        ];

        const contractsToUpdate = await AllContracts.aggregate(pipeline);

        if (contractsToUpdate.length > 0) {
            const bulkOps = contractsToUpdate.map(contract => ({
                updateOne: {
                    filter: { _id: contract._id },
                    update: { $set: { status: contract.newStatus } }
                }
            }));

            const result = await AllContracts.bulkWrite(bulkOps);
            console.log(`Updated ${result.modifiedCount} contracts`);
        } else {
            console.log('No contracts need updating');
        }
    } catch (error) {
        console.error("Error updating contract status:", error);
    }
}

// Schedule the contract status update task to run periodically
const updateInterval = 60 * 60 * 1000; // Run every hour
setInterval(updateContractStatus, updateInterval);

module.exports = updateContractStatus;