const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Tenant = require('./models/Tenant');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/undefined', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected to undefined database...');

    // Admin user details
    const adminEmail = 'admin@coseke.com';
    const adminPassword = 'coseke@2025';

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists with email:', adminEmail);
      console.log('User details:');
      console.log('- Email:', existingAdmin.email);
      console.log('- Name:', existingAdmin.firstname, existingAdmin.lastname);
      console.log('- Role:', existingAdmin.role);
      console.log('\nYou can use these credentials to login:');
      console.log('Email:', adminEmail);
      console.log('Password: coseke@2025');
      await mongoose.connection.close();
      return;
    }

    // Find or create a default tenant/company
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
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const adminUser = new User({
      firstname: 'Admin',
      lastname: 'Coseke',
      email: adminEmail,
      password: hashedPassword,
      phone: '+1234567890',
      role: 'admin',
      company: tenant._id,
    });

    await adminUser.save();

    console.log('\n✅ Admin user created successfully!');
    console.log('\nAdmin Login Credentials:');
    console.log('========================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role:', adminUser.role);
    console.log('Company:', tenant.name);
    console.log('========================\n');

    await mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error creating admin user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createAdminUser();
