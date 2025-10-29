import nodemailer, { Transporter } from 'nodemailer';
import { templateService } from './template.service';

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
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
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
      'Welcome to FinWise - Verification in Progress',
      'parent-welcome',
      { name }
    );
  }

  /**
   * Send welcome email for child signup
   */
  async sendChildWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendTemplateEmail(
      email,
      'Welcome to FinWise',
      'child-welcome',
      { name }
    );
  }

  /**
   * Send verification received confirmation
   */
  async sendVerificationReceivedEmail(email: string, name: string): Promise<void> {
    await this.sendTemplateEmail(
      email,
      'FinWise - Verification Documents Received',
      'verification-received',
      { name }
    );
  }

  /**
   * Send verification approved email
   */
  async sendVerificationApprovedEmail(email: string, name: string): Promise<void> {
    await this.sendTemplateEmail(
      email,
      'FinWise - Account Verified!',
      'verification-approved',
      { name }
    );
  }

  /**
   * Send verification rejected email
   */
  async sendVerificationRejectedEmail(email: string, name: string, reason: string): Promise<void> {
    await this.sendTemplateEmail(
      email,
      'FinWise - Additional Information Needed',
      'verification-rejected',
      { name, reason }
    );
  }
}

export const mailerService = new MailerService();
