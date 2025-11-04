import nodemailer, { Transporter } from "nodemailer";
import { templateService } from "./template.service";

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
    cid?: string; // Content ID for embedded images
  }>;
}

export class MailerService {
  private transporter: Transporter;
  private from: string;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== "production";

    // Use MailDev defaults in development
    if (this.isDevelopment) {
      this.from = process.env.MAIL_FROM || "noreply@finwise.app";

      // MailDev configuration (runs on localhost:1025, web UI on :1080)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: parseInt(process.env.SMTP_PORT || "1025"),
        secure: false, // MailDev doesn't use TLS
        // No auth required for MailDev
      });

      console.log("📧 [Mailer] Development mode - using MailDev");
      console.log("📧 [Mailer] SMTP: localhost:1025");
      console.log("📧 [Mailer] Web UI: http://localhost:1080");
    } else {
      // Production SMTP configuration
      this.from = process.env.MAIL_FROM || "noreply@finwise.app";

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Send email with template
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });
  }

  /**
   * Send email using template
   */
  private async sendTemplateEmail(
    to: string,
    subject: string,
    templateName: string,
    variables: Record<string, string>
  ): Promise<void> {
    const html = await templateService.render(templateName, variables);

    // Generate plain text version (strip HTML tags)
    const text = html
      .replace(/<style[^>]*>.*?<\/style>/gs, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Send welcome email for parent signup
   */
  async sendParentWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendTemplateEmail(
      email,
      "Welcome to FinWise - Verification in Progress",
      "parent-welcome",
      { name }
    );
  }

  /**
   * Send welcome email for child signup
   */
  async sendChildWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendTemplateEmail(email, "Welcome to FinWise", "child-welcome", {
      name,
    });
  }

  /**
   * Send verification received confirmation
   */
  async sendVerificationReceivedEmail(
    email: string,
    name: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      email,
      "FinWise - Verification Documents Received",
      "verification-received",
      { name }
    );
  }

  /**
   * Send verification approved email
   */
  async sendVerificationApprovedEmail(
    email: string,
    name: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      email,
      "FinWise - Account Verified!",
      "verification-approved",
      { name }
    );
  }

  /**
   * Send verification rejected email
   */
  async sendVerificationRejectedEmail(
    email: string,
    name: string,
    reason: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      email,
      "FinWise - Additional Information Needed",
      "verification-rejected",
      { name, reason }
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetLink: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      email,
      "FinWise - Reset Your Password",
      "password-reset",
      { name, resetLink }
    );
  }

  /**
   * Send admin notification email for parent signup approval
   * Includes ID image as embedded image in HTML email
   */
  async sendParentSignupNotificationToAdmin(
    parentEmail: string,
    parentName: string,
    userId: string,
    idImageBuffer: Buffer,
    idImageFilename: string
  ): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@finwise.app";

    // Convert image buffer to base64 for embedding in HTML
    const base64Image = idImageBuffer.toString("base64");
    const imageMimeType = idImageFilename.toLowerCase().endsWith(".png")
      ? "image/png"
      : "image/jpeg";
    const imageDataUri = `data:${imageMimeType};base64,${base64Image}`;

    // Create HTML email with embedded image
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4F46E5;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .info-box {
      background-color: #fff;
      border-left: 4px solid #4F46E5;
      padding: 15px;
      margin: 20px 0;
    }
    .id-image {
      max-width: 100%;
      height: auto;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4F46E5;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 10px 5px;
    }
    .button.reject {
      background-color: #dc2626;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔔 New Parent Signup Request</h1>
  </div>
  
  <div class="content">
    <h2>Review Required</h2>
    <p>A new parent account signup requires your approval:</p>
    
    <div class="info-box">
      <strong>👤 Parent Information:</strong>
      <ul>
        <li><strong>Name:</strong> ${parentName}</li>
        <li><strong>Email:</strong> ${parentEmail}</li>
        <li><strong>User ID:</strong> ${userId}</li>
      </ul>
    </div>

    <h3>📷 ID Verification Image:</h3>
    <img src="${imageDataUri}" alt="ID Verification Image" class="id-image" />
    
    <div class="info-box">
      <strong>⚠️ Action Required:</strong>
      <p>Please review the ID image above and approve or reject this signup request.</p>
      <p>You can do this through the admin panel or by using the API endpoints.</p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <p><strong>Next Steps:</strong></p>
      <p>Use the admin panel to review and approve/reject this signup request.</p>
    </div>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from FinWise.</p>
    <p>&copy; ${new Date().getFullYear()} FinWise. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    // Plain text version
    const text = `
New Parent Signup Request

A new parent account signup requires your approval:

Parent Information:
- Name: ${parentName}
- Email: ${parentEmail}
- User ID: ${userId}

ID Verification Image:
An ID verification image has been attached to this email. Please review it and approve or reject the signup request through the admin panel.

This is an automated notification from FinWise.
    `.trim();

    await this.sendEmail({
      to: adminEmail,
      subject: `🔔 New Parent Signup Request - ${parentName}`,
      html,
      text,
      attachments: [
        {
          filename: idImageFilename,
          content: idImageBuffer,
          contentType: imageMimeType,
        },
      ],
    });

    console.log(
      `📧 [Mailer] Sent parent signup notification to admin: ${adminEmail}`
    );
  }
}

export const mailerService = new MailerService();
