import emailService from './email.helper';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  const recipient = process.env.MAIL_USERNAME;
  if (!recipient) {
    console.error('MAIL_USERNAME not found in .env file.');
    return;
  }

  console.log(`Sending test email to ${recipient}...`);

  try {
    await emailService.sendMail(
      recipient,
      'Test Email from Nodemailer',
      '<h1>Hello World!</h1><p>This is a test email sent from the renew-ssl TypeScript application using Gmail SMTP.</p>'
    );
    console.log('Test email sent successfully.');
  } catch (error) {
    console.error('Failed to send test email:', error);
  }
}

testEmail(); 