import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

if (
  !process.env.MAIL_HOST ||
  !process.env.MAIL_PORT ||
  !process.env.MAIL_USERNAME ||
  !process.env.MAIL_PASSWORD
) {
  throw new Error(
    'Missing required MAIL environment variables: MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD'
  );
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    console.log('SMTP Configuration:');
    console.log('Host:', process.env.MAIL_HOST);
    console.log('Port:', process.env.MAIL_PORT);
    console.log('Username:', process.env.MAIL_USERNAME);
    console.log('Encryption:', process.env.MAIL_ENCRYPTION);
    console.log('From Name:', process.env.MAIL_FROM_NAME);
    
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '465'),
      secure: process.env.MAIL_ENCRYPTION === 'ssl', // true for SSL (465), false for TLS (587)
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  public async sendMail(to: string, subject: string, html: string) {
    const fromName = process.env.MAIL_FROM_NAME || 'Email Service';
    const fromEmail = process.env.MAIL_USERNAME;
    
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: subject,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

export default new EmailService(); 