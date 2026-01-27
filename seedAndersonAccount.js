const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Tenant = require('./models/Tenant');
require('dotenv').config();

const seedAndersonAccount = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/undefined', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected to undefined database...');

    // User details
    const userEmail = 'anderson.mwangi@coseke.com';
    const userPassword = 'Password@123';

    // Check if user already exists
    const existingUser = await User.findOne({ email: userEmail });
    if (existingUser) {
      console.log('User already exists with email:', userEmail);
      console.log('User details:');
      console.log('- Email:', existingUser.email);
      console.log('- Name:', existingUser.firstname, existingUser.lastname);
      console.log('- Role:', existingUser.role);
      console.log('\nYou can use these credentials to login:');
      console.log('Email:', userEmail);
      console.log('Password: Password@123');
      await mongoose.connection.close();
      return;
    }

    // Find existing tenant (or create default)
    let tenant = await Tenant.findOne();
    if (!tenant) {
      console.log('No tenant found. Creating default tenant...');

      // Generate a unique license key
      const crypto = require('crypto');
      const licenseKey = `COSEKE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      tenant = new Tenant({
        name: 'Coseke',
        description: 'Coseke Contract Management System',
        licenseKey: licenseKey,
        licenseType: 'Enterprise',
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        features: ['contracts', 'reports', 'users', 'analytics'],
      });
      await tenant.save();
      console.log('Default tenant created:', tenant.name);
      console.log('License Key:', licenseKey);
    } else {
      console.log('Using existing tenant:', tenant.name);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userPassword, salt);

    // Create user
    const user = new User({
      firstname: 'Anderson',
      lastname: 'Mwangi',
      email: userEmail,
      password: hashedPassword,
      phone: '+254700000000',
      role: 'admin',
      company: tenant._id,
    });

    await user.save();

    console.log('\n✅ User account created successfully!');
    console.log('\nLogin Credentials:');
    console.log('========================');
    console.log('Email:', userEmail);
    console.log('Password:', userPassword);
    console.log('Role:', user.role);
    console.log('Company:', tenant.name);
    console.log('========================\n');

    await mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error creating user account:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAndersonAccount();
