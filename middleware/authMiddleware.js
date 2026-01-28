const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');

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

        // Note: Tenant information is available via user.company
        // All data is stored in a single database ('undefined')
        // No need to switch databases per tenant

        next();
    } catch (err) {
        console.error('Authentication error:', err.message);
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = isAuthenticated;
