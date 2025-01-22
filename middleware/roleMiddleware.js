const User = require('../models/User');

const roleMiddleware = (requiredRoles) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({ msg: 'User not found 🔍🔍' });
            }

            // Directly compare the user's role with the required roles
            if (!requiredRoles.includes(user.role)) {
                return res.status(403).json({ msg: 'Access denied! 🚫🚫' });
            }

            next();
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server error 🚫🚫');
        }
    };
};

module.exports = roleMiddleware;
