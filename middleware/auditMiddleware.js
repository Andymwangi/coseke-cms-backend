const AuditLog = require("../models/AuditLog");

async function auditTrail(req, res, next) {
    try {
        const { method, url, params, body, user } = req;
        let action = { method, url, params };

        if (user) {
            action.user = {
                firstname: user.firstname,
                lastname: user.lastname,
                company: user.company,
                role: user.role,
                email: user.email,
            };
        }

        if (body && body.password) {
            const { password, ...bodyWithoutPassword } = body;
            action.body = bodyWithoutPassword;
        } else {
            action.body = body;
        }

        console.log("Audit Trail:", action);
        await AuditLog.create(action);
        next();
    } catch (error) {
        console.error("Error storing audit trail:", error);
        next();
    }
}

module.exports = { auditTrail };
