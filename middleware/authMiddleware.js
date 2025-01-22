const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');
const Tenant = require('../models/Tenant'); // Import the Tenant model
const connectDB = require('../config/db'); // Import the connectDB function

dotenv.config();

const isAuthenticated = async (req, res, next) => {
    const token = req.header('x-auth-token');
    // console.log('User token accessing server resources;', token)

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied 🚫🚫' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;

        // Fetch user details from the database
        const user = await User.findById(req.user.id).select('-password'); // Exclude the password field
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        req.user = user;

        // Fetch tenant details based on the user's company (tenant) information
        const tenant = await Tenant.findById(user.company); // Assuming user.company is the tenant's _id

        if (!tenant) {
            return res.status(404).json({ msg: 'Tenant not found' });
        }

        // Connect to the tenant's database
        await connectDB(tenant.name); // Assume tenant.name is used as the database name

        next();
    } catch (err) {
        console.error('Authentication error:', err.message);
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = isAuthenticated;
