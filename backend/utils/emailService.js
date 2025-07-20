const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.warn('Email service not configured - EMAIL_USER and EMAIL_PASS required');
      return;
    }

    this.transporter = nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('Email service verification failed:', error);
      } else {
        logger.info('Email service ready');
      }
    });
  }

  async sendEmail({ to, subject, text, html, from }) {
    if (!this.transporter) {
      logger.warn('Email service not available - skipping email send');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: from || process.env.SYSTEM_EMAIL || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${subject}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Marketplace!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Marketplace, ${user.name}!</h2>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        <p>You can now:</p>
        <ul>
          <li>Browse and search products</li>
          <li>Create your own listings</li>
          <li>Connect with other users</li>
          <li>Manage your profile</li>
        </ul>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Happy shopping!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset for your Marketplace account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">Reset Password</a>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendProductApprovalEmail(user, product, approved) {
    const status = approved ? 'Approved' : 'Rejected';
    const subject = `Product ${status}: ${product.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${approved ? '#28a745' : '#dc3545'};">Product ${status}</h2>
        <p>Hi ${user.name},</p>
        <p>Your product listing "${product.title}" has been ${approved ? 'approved' : 'rejected'}.</p>
        ${approved ? 
          '<p>Your product is now live and visible to other users!</p>' : 
          '<p>Please review our guidelines and make necessary adjustments before resubmitting.</p>'
        }
        <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin: 16px 0;">
          <h3 style="margin-top: 0;">${product.title}</h3>
          <p><strong>Price:</strong> $${product.price}</p>
          <p><strong>Category:</strong> ${product.category}</p>
        </div>
        <p>Thank you for using Marketplace!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendNotificationEmail(user, notification) {
    const subject = `New Notification: ${notification.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Notification</h2>
        <p>Hi ${user.name},</p>
        <div style="border-left: 4px solid #007bff; padding-left: 16px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #007bff;">${notification.title}</h3>
          <p>${notification.message}</p>
        </div>
        <p>Visit your dashboard to see more details.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">View Dashboard</a>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }
}

module.exports = new EmailService();
