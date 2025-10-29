import nodemailer, { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class MailerService {
  private transporter: Transporter;
  private from: string;

  constructor() {
    this.from = process.env.MAIL_FROM || 'noreply@finwise.app';
    
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  /**
   * Send welcome email for parent signup
   */
  async sendParentWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to FinWise - Verification in Progress',
      html: this.renderParentWelcome(name),
      text: `Welcome to FinWise, ${name}!\n\nYour parent account has been created successfully. Our team is reviewing your verification documents and will get back to you within 1-2 business days.\n\nThank you for choosing FinWise!`,
    });
  }

  /**
   * Send welcome email for child signup
   */
  async sendChildWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to FinWise',
      html: this.renderChildWelcome(name),
      text: `Welcome to FinWise, ${name}!\n\nYour account has been created successfully. A parent or guardian will need to link your account to their household to get started.\n\nThank you for joining FinWise!`,
    });
  }

  /**
   * Send verification received confirmation
   */
  async sendVerificationReceivedEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'FinWise - Verification Documents Received',
      html: this.renderVerificationReceived(name),
      text: `Hello ${name},\n\nWe have received your verification documents and they are currently under review. You will receive a notification once the review is complete.\n\nThank you for your patience!`,
    });
  }

  /**
   * Send verification approved email
   */
  async sendVerificationApprovedEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'FinWise - Account Verified!',
      html: this.renderVerificationApproved(name),
      text: `Congratulations ${name}!\n\nYour FinWise account has been verified and you now have full access to all features.\n\nGet started by creating your first household!`,
    });
  }

  /**
   * Send verification rejected email
   */
  async sendVerificationRejectedEmail(email: string, name: string, reason: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'FinWise - Additional Information Needed',
      html: this.renderVerificationRejected(name, reason),
      text: `Hello ${name},\n\nWe need some additional information to complete your verification:\n\n${reason}\n\nPlease contact our support team for assistance.`,
    });
  }

  // Email Templates

  private renderParentWelcome(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FinWise!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for creating a parent account with FinWise. We're excited to help you manage your family's finances!</p>
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our team is reviewing your verification documents</li>
              <li>You'll receive a confirmation within 1-2 business days</li>
              <li>Once verified, you'll have full access to all features</li>
            </ul>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            <p>Best regards,<br>The FinWise Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderChildWelcome(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FinWise!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your FinWise account has been created successfully!</p>
            <p>A parent or guardian will need to link your account to their household. Once connected, you'll be able to:</p>
            <ul>
              <li>Track your spending</li>
              <li>Set savings goals</li>
              <li>Learn about money management</li>
            </ul>
            <p>We're excited to help you learn about finances!</p>
            <p>Best regards,<br>The FinWise Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderVerificationReceived(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>We have received your verification documents and they are currently under review.</p>
            <p>Our team typically completes reviews within 1-2 business days. You will receive a notification via email once the review is complete.</p>
            <p>Thank you for your patience!</p>
            <p>Best regards,<br>The FinWise Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderVerificationApproved(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Account Verified!</h1>
          </div>
          <div class="content">
            <h2>Congratulations ${name}!</h2>
            <p>Your FinWise account has been successfully verified. You now have full access to all features!</p>
            <p><strong>Get Started:</strong></p>
            <ul>
              <li>Create your first household</li>
              <li>Add family members</li>
              <li>Set up your financial accounts</li>
              <li>Start tracking your expenses</li>
            </ul>
            <p>We're here to help you achieve your financial goals!</p>
            <p>Best regards,<br>The FinWise Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderVerificationRejected(name: string, reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
          .reason { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>We need some additional information to complete your account verification.</p>
            <div class="reason">
              <strong>Reason:</strong><br>
              ${reason}
            </div>
            <p>Please contact our support team at support@finwise.app for assistance.</p>
            <p>We're here to help!</p>
            <p>Best regards,<br>The FinWise Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const mailerService = new MailerService();
