const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get user profile
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// ADMIN UPDATING DETAILS OF A USER 
exports.updateUser = async (req, res) => {
    const { firstname, lastname, email, password } = req.body;
    const userId = req.params.id; // Assuming the user ID is passed as a route parameter

    try {
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const updates = {};
        let hasChanges = false;

        // Check and update firstname
        if (firstname && firstname !== user.firstname) {
            updates.firstname = firstname;
            hasChanges = true;
        }

        // Check and update lastname
        if (lastname && lastname !== user.lastname) {
            updates.lastname = lastname;
            hasChanges = true;
        }

        // Check and update email
        if (email && email !== user.email) {
            // Check if the new email is already in use by another user
            const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
            if (existingUser) {
                return res.status(400).json({ msg: 'Email already in use' });
            }
            updates.email = email;
            hasChanges = true;
        }

        // Handle password update only if a new password is provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
            hasChanges = true;
        }

        if (hasChanges) {
            user = await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { new: true }
            ).select('-password'); // Exclude password from the returned user object

            res.json({ message: 'User updated successfully', user });
        } else {
            res.json({ message: 'No changes detected', user: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) });
        }
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ msg: 'Server error' });
    }
};

// Delete user account
exports.deleteUser = async (req, res) => {
    try {
        await User.findByIdAndRemove(req.user.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find(req.queryFilter).select('-password'); // Exclude password from response
        if (!users || users.length === 0) {
            return res.status(404).json({ msg: 'No users found' });
        }
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select('-password'); // Exclude password from response

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Update user by ID (for admin or authorized user)
exports.updateUserById = async (req, res) => {
    const { firstname, lastname, email, password } = req.body;
    const userId = req.params.id;

    const userFields = {};
    if (firstname) userFields.firstname = firstname;
    if (lastname) userFields.lastname = lastname;
    if (email) userFields.email = email;
    if (password) {
        const salt = await bcrypt.genSalt(10);
        userFields.password = await bcrypt.hash(password, salt);
    }

    try {
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        user = await User.findByIdAndUpdate(
            userId,
            { $set: userFields },
            { new: true }
        );

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete user account by ID
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        await user.deleteOne(); // Use deleteOne instead of findByIdAndRemove

        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Update user's own profile
exports.updateUserProfile = async (req, res) => {
    const { firstname, lastname, email, password } = req.body;
    const userId = req.user.id; // Get the user ID from the authenticated user

    try {
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const updates = {};
        let hasChanges = false;

        // Check and update firstname
        if (firstname && firstname !== user.firstname) {
            updates.firstname = firstname;
            hasChanges = true;
        }

        // Check and update lastname
        if (lastname && lastname !== user.lastname) {
            updates.lastname = lastname;
            hasChanges = true;
        }

        // Check and update email
        if (email && email !== user.email) {
            // Check if the new email is already in use by another user
            const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
            if (existingUser) {
                return res.status(400).json({ msg: 'Email already in use' });
            }
            updates.email = email;
            hasChanges = true;
        }

        // Handle password update only if a new password is provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
            hasChanges = true;
        }

        if (hasChanges) {
            user = await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { new: true }
            ).select('-password'); // Exclude password from the returned user object

            res.json({ message: 'Profile updated successfully', user });
        } else {
            res.json({ message: 'No changes detected', user: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) });
        }
    } catch (err) {
        console.error('Error updating user profile:', err);
        res.status(500).json({ msg: 'Server error' });
    }
};


// Update user role
exports.updateUserRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
  
    // Debug logs
    console.log('Request params received to update user role:', req.params);
    console.log('Request received to update user role:', req.body);
  
    try {
      // Validate the role
      if (!['staff', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
  
      // Find and update the user role
      const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.json({ role: user.role });
    } catch (error) {
      console.error('Error updating user role:', error.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  };


