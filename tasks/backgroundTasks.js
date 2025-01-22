const cron = require("node-cron");
const nodemailer = require("nodemailer");
const AllContracts = require("../models/AllContracts");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

const generateContractMessage = (contract, daysRemaining) => {
  const endDate = new Date(contract.endDate).toLocaleDateString();
  let status, buttonColor;

  if (daysRemaining === 0) {
    status = "Expired";
    buttonColor = "#DC3545";
  } else if (daysRemaining === 1) {
    status = "Expires Today";
    buttonColor = "#FFC107";
  } else if (daysRemaining <= 7) {
    status = "Expiring Soon";
    buttonColor = "#FD7E14";
  } else {
    status = "Active";
    buttonColor = "#28A745";
  }

  return `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${contract["Contract Number"]}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${contract["Contract Description"]}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${endDate}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
        <span style="background-color: ${buttonColor}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;">
          ${status}
        </span>
      </td>
    </tr>
  `;
};

const groupContractsByExpiry = (contracts) => {
  const today = new Date();
  const expiryGroups = { 0: [], 1: [], 7: [], 30: [], 90: [] };

  contracts.forEach((contract) => {
    const daysRemaining = Math.ceil(
      (new Date(contract.endDate) - today) / (1000 * 60 * 60 * 24)
    );
    if (daysRemaining >= 0 && daysRemaining <= 90) {
      const key =
        daysRemaining === 0
          ? 0
          : daysRemaining === 1
          ? 1
          : daysRemaining <= 7
          ? 7
          : daysRemaining <= 30
          ? 30
          : 90;
      expiryGroups[key].push({ ...contract, daysRemaining });
    }
  });

  return expiryGroups;
};

const formatEmailContent = (expiryGroups, companyName) => {
  const groupTitles = {
    0: "Expired Contracts",
    1: "Contracts Expiring Today",
    7: "Contracts Expiring Within 7 Days",
    30: "Contracts Expiring Within 30 Days",
    90: "Contracts Expiring Within 90 Days",
  };

  let content = `
    <h1 style="color: #2c3e50; text-align: center; font-size: 24px; margin-bottom: 20px;">
      Contract Expiration Reminder for ${companyName}
    </h1>
    <p style="font-size: 16px; line-height: 1.5;">Dear Team,</p>
    <p style="font-size: 16px; line-height: 1.5;">This is a kind reminder regarding the status of our contracts:</p>
  `;

  let hasContracts = false;

  Object.entries(expiryGroups).forEach(([days, contracts]) => {
    if (contracts.length > 0) {
      hasContracts = true;
      content += `
        <h2 style="color: #34495e; font-size: 20px; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">
          ${groupTitles[days]}
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Contract Number</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Description</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">End Date</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${contracts.map(contract => generateContractMessage(contract, contract.daysRemaining)).join('')}
          </tbody>
        </table>
      `;
    }
  });

  if (!hasContracts) {
    content += `
      <p style="font-size: 16px; line-height: 1.5; background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px;">
        Good news! There are currently no contracts expiring within the next 90 days that require attention.
      </p>
    `;
  }

  return content;
};

const sendReminderEmail = async (recipientEmails, emailContent, companyName) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL || process.env.SMTP_USER,
    to: recipientEmails.join(","),
    subject: `CONTRACT EXPIRATION REMINDER - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contract Expiration Reminder</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .content { padding: 20px; }
            .footer { background-color: #34495e; color: #ecf0f1; text-align: center; padding: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              ${emailContent}
              <p style="font-size: 16px; line-height: 1.5;">Please review the status of these contracts and take appropriate action as necessary.</p>
              <p style="font-size: 16px; line-height: 1.5;">Thank you for your attention to this matter.</p>
              <p style="font-size: 16px; line-height: 1.5;">
                Best Regards,<br>
                intelleX Contract Management System
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0; font-size: 14px;">This is an automated message from intelleX CLMS. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const processTenantsContracts = async () => {
  const tenants = await Tenant.find({});

  for (const tenant of tenants) {
    try {
      const [users, contracts] = await Promise.all([
        User.find({ company: tenant._id }, "email"),
        AllContracts.find({ 
          company: tenant._id, 
          endDate: { $gte: new Date(), $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } 
        }).lean(),
      ]);

      const recipientEmails = users.map((user) => user.email);
      const expiryGroups = groupContractsByExpiry(contracts);
      const emailContent = formatEmailContent(expiryGroups, tenant.name);

      if (recipientEmails.length > 0) {
        await sendReminderEmail(recipientEmails, emailContent, tenant.name);
        console.log(`Email reminder sent successfully for ${tenant.name} ✅✅`);
      } else {
        console.log(`No users to send reminders for ${tenant.name}.`);
      }
    } catch (error) {
      console.error(`Error processing reminders for ${tenant.name}:`, error);
    }
  }
};

const startScheduler = () => {
  cron.schedule(process.env.CRON_SCHEDULE, async () => {
    console.log("intelleX CLMS is Running Reminder Task  🔄🔄...");
    try {
      await processTenantsContracts();
    } catch (error) {
      console.error("Error in reminder scheduler:", error);
    }
  });

  console.log("Multi-tenant reminder scheduler started successfully. ✅✅");
};

module.exports = { startScheduler };