const User = require('../models/User');
const Tenant = require('../models/Tenant');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const { promisify } = require('util');
const crypto = require('crypto');

const jwtSign = promisify(jwt.sign);

// Store recent OTP requests to prevent duplicates
const otpRequestCache = new Map();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
});

const generateToken = async (user) => {
    const payload = {
        user: {
            id: user.id,
            role: user.role,
            company: user.company
        }
    };
    return await jwtSign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Your OTP for Login for intelleX CLMS 🤞🤞',
        html: `
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <h2 style="color: #2ecc71;">Your OTP for Login</h2>
                    <p style="font-size: 16px;">Hello,</p>
                    <p style="font-size: 16px;">Your OTP is <strong style="font-size: 24px; color: #e74c3c;">${otp}</strong>.</p>
                    <p style="font-size: 16px;">It will expire in 5 minutes. Please use it to complete your login process.</p>
                    <p style="font-size: 16px;">Best Regards,</p>
                    <p style="font-size: 16px;"><strong>intelleX Contract Management System</strong></p>
                    <p style="font-size: 12px; color: #777;">If you did not request this OTP, please ignore this email or contact support.</p>
                </div>
            </body>
            </html>
        `
    };
    await transporter.sendMail(mailOptions);
};


exports.register = async (req, res) => {
    const { firstname, lastname, email, password, phone, role, company } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with this email already exists ❌❌' });
        }

        const tenant = await Tenant.findById(company);
        if (!tenant) {
            return res.status(400).json({ msg: 'Invalid company ID' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpiry = Date.now() + 86400000; // 24 hours from now

        const user = new User({
            firstname,
            lastname,
            email,
            password: hashedPassword,
            phone,
            role,
            company,
            createdAt: Date.now(),
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpiry
        });

        await user.save();

        // Send registration email
        await sendRegistrationEmail(email, firstname, resetToken);

        const token = await generateToken(user);
        res.status(201).json({
            msg: 'User registered successfully ✅✅',
            token,
            user: {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                company: user.company,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ msg: 'Server error ❌❌' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log('Login attempt:', { email, passwordLength: password?.length });
        const user = await User.findOne({ email });
        console.log('User found:', !!user);
        if (!user) {
            console.log('User not found');
            return res.status(400).json({ msg: 'Your login Credentials are Invalid ❌❌' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', passwordMatch);
        if (!passwordMatch) {
            console.log('Password mismatch');
            return res.status(400).json({ msg: 'Your login Credentials are Invalid ❌❌' });
        }

        // Check if OTP was recently sent to prevent duplicates
        const cacheKey = `otp_${user.id}`;
        const lastOtpTime = otpRequestCache.get(cacheKey);
        const now = Date.now();

        if (lastOtpTime && (now - lastOtpTime) < 30000) { // 30 seconds cooldown
            return res.json({
                msg: 'OTP already sent. Please check your email or wait 30 seconds to resend. ✅✅',
                userId: user.id
            });
        }

        const otp = speakeasy.totp({
            secret: process.env.OTP_SECRET + user.email,
            encoding: 'base32',
            step: 300 // 5 minutes
        });

        await sendOTP(user.email, otp);

        // Cache this OTP request
        otpRequestCache.set(cacheKey, now);
        // Clear cache after 5 minutes
        setTimeout(() => otpRequestCache.delete(cacheKey), 300000);

        res.json({
            msg: 'OTP sent to your email ✅✅',
            userId: user.id
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ msg: 'Server error ❌❌' });
    }
};

exports.verifyOtp = async (req, res) => {
    const { userId, otp } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ msg: 'User not found ❌❌' });
        }

        const secret = process.env.OTP_SECRET + user.email;
        const isVerified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: otp,
            window: 2,
            step: 300 // 5 minutes, window: 2 allows ~15 min tolerance for email delays
        });

        if (!isVerified) {
            return res.status(400).json({ msg: 'Invalid OTP ❌❌' });
        }

        const token = await generateToken(user);
        res.json({
            msg: 'Login successful ✅✅',
            token,
            user: {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                company: user.company,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(500).json({ msg: 'Server error ❌❌' });
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Password Reset Request - intelleX CLMS',
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset - intelleX CLMS</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f7f6; color: #333;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%; background-color: #f4f7f6;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background-color: #2ecc71; padding: 30px 40px; text-align: center;">
                                    <h1 style="color: #ffffff; font-size: 28px; margin: 0;">intelleX CLMS</h1>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px;">
                                    <h2 style="color: #2ecc71; font-size: 24px; margin: 0 0 20px;">Password Reset Request</h2>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Hello,</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">To reset your password, please click the button below:</p>
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <a href="${resetUrl}" style="background-color: #2ecc71; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
                                    </div>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
                                    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 20px; word-break: break-all; color: #2ecc71;">${resetUrl}</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">This link will expire in 1 hour for security reasons.</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Best Regards,<br><strong>intelleX Contract Management System</strong></p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f4f7f6; padding: 20px 40px; text-align: center; font-size: 14px; color: #888888;">
                                    <p style="margin: 0 0 10px;">© 2024 intelleX CLMS. All rights reserved.</p>
                                    <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `
    };
    await transporter.sendMail(mailOptions);
};

const sendRegistrationEmail = async (email, firstname, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Welcome to intelleX CLMS - Account Created',
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to intelleX CLMS</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f7f6; color: #333;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%; background-color: #f4f7f6;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background-color: #2ecc71; padding: 30px 40px; text-align: center;">
                                    <h1 style="color: #ffffff; font-size: 28px; margin: 0;">Welcome to intelleX CLMS</h1>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px;">
                                    <h2 style="color: #2ecc71; font-size: 24px; margin: 0 0 20px;">Account Created Successfully</h2>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Hello ${firstname},</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Your account has been created successfully. Here are your login details:</p>
                                    <ul style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
                                        <li>Email: ${email}</li>
                                    </ul>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">For security reasons, we recommend that you reset your password immediately. Please click the button below to set a new password:</p>
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <a href="${resetUrl}" style="background-color: #2ecc71; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Set New Password</a>
                                    </div>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">If the button doesn't work, you can copy and paste this link into your browser:</p>
                                    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 20px; word-break: break-all; color: #2ecc71;">${resetUrl}</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">This link will expire in 24 hours for security reasons.</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Welcome aboard and thank you for choosing intelleX CLMS!</p>
                                    <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Best Regards,<br><strong>intelleX Contract Management System</strong></p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f4f7f6; padding: 20px 40px; text-align: center; font-size: 14px; color: #888888;">
                                    <p style="margin: 0 0 10px;">© 2024 intelleX CLMS. All rights reserved.</p>
                                    <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `
    };
    await transporter.sendMail(mailOptions);
};

exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ msg: 'User not found ❌❌' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        await sendPasswordResetEmail(user.email, resetToken);

        res.json({ msg: 'Password reset email sent ✅✅' });
    } catch (err) {
        console.error('Password reset request error:', err);
        res.status(500).json({ msg: 'Server error ❌❌' });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid or expired reset token ❌❌' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ msg: 'Password has been reset successfully ✅✅' });
    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ msg: 'Server error ❌❌' });
    }
};