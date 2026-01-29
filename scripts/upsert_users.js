const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const usersToUpsert = [
    { email: 'robert.waithaka@coseke.com', firstname: 'Robert', lastname: 'Waithaka', password: 'Coseke', role: 'staff' },
    { email: 'jeff.nduva@coseke.com', firstname: 'Jeff', lastname: 'Nduva', password: 'Password', role: 'staff' },
    { email: 'jeff.thuo@coseke.com', firstname: 'Jeff', lastname: 'Thuo', password: 'Coseke@2026', role: 'admin' }
];

const upsertUsers = async () => {
    try {
        // Connect to MongoDB - using 'undefined' as the database name (matches seedTestUser.js)
        await mongoose.connect('mongodb://localhost:27017/undefined', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected to undefined database...');

        // 1. Find or Create Tenant 'Coseke'
        let tenant = await Tenant.findOne({ name: { $regex: /coseke/i } });
        
        if (!tenant) {
            console.log("Tenant 'Coseke' not found. Creating...");
            const crypto = require('crypto');
            const licenseKey = `COSEKE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
            
            tenant = new Tenant({
                name: 'Coseke',
                description: 'Coseke Tenant',
                licenseKey: licenseKey,
                licenseType: 'Enterprise',
                features: ['All']
            });
            await tenant.save();
            console.log("Tenant 'Coseke' created successfully.");
            console.log('License Key:', licenseKey);
        } else {
             console.log("Using existing tenant:", tenant.name);
        }
        console.log("Tenant ID:", tenant._id);

        console.log('\nProcessing users...');
        console.log('========================');

        // 2. Upsert Users
        for (const userData of usersToUpsert) {
            const { email, firstname, lastname, password, role } = userData;
            
            // Hash the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            let user = await User.findOne({ email: email.toLowerCase() });

            if (user) {
                user.firstname = firstname;
                user.lastname = lastname;
                user.password = hashedPassword;
                user.company = tenant._id;
                user.role = role;
                
                await user.save();
                console.log(`✅ User Updated: ${email} (${role})`);
            } else {
                user = new User({
                    firstname,
                    lastname,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    company: tenant._id,
                    role: role,
                    phone: '' // Optional default
                });
                await user.save();
                console.log(`✅ User Created: ${email} (${role})`);
            }
        }
        
        console.log('========================');
        console.log('All Coseke users processed successfully.');

        await mongoose.connection.close();
        console.log('Database connection closed.');
    } catch (err) {
        console.error('Error processing users:', err);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

upsertUsers();
