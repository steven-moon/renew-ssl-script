import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import emailService from './email.helper';

dotenv.config();

const execAsync = promisify(exec);

async function runCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error: any) {
    console.error(`Error executing command: ${command}`, error.stderr);
    throw new Error(error.stderr);
  }
}

function parseCertsToHtml(certbotOutput: string): string {
  const lines = certbotOutput.split('\n');
  let html = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">';
  html += '<tr><th>Status</th><th>Certificate Name</th><th>Domains</th><th>Expiry Date</th></tr>';

  let certName = '', domains = '', expiry = '', status = '';

  lines.forEach(line => {
    if (line.includes('Certificate Name:')) {
      if (certName) { // save previous entry
        html += `<tr><td>${status}</td><td>${certName}</td><td>${domains}</td><td>${expiry}</td></tr>`;
      }
      certName = line.split(':')[1].trim();
      domains = '';
      expiry = '';
      status = '';
    } else if (line.includes('Domains:')) {
      domains = line.split(':')[1].trim();
    } else if (line.includes('Expiry Date:')) {
      const match = line.match(/Expiry Date:\s*([^ ]+[ ][^ ]+)[ ]+\(([^)]*)\)/);
      if (match) {
        expiry = match[1];
        status = match[2];
      }
    }
  });

  if (certName) { // save last entry
    html += `<tr><td>${status}</td><td>${certName}</td><td>${domains}</td><td>${expiry}</td></tr>`;
  }

  html += '</table>';
  return html;
}

function countTotalCertificates(certbotOutput: string): number {
  const lines = certbotOutput.split('\n');
  let totalCerts = 0;

  lines.forEach(line => {
    if (line.includes('Certificate Name:')) {
      totalCerts++;
    }
  });

  return totalCerts;
}

function parseRenewalCounts(certbotRenewOutput: string): { needingRenewal: number, successfulRenewal: number } {
  const lines = certbotRenewOutput.split('\n');
  let needingRenewal = 0;
  let successfulRenewal = 0;

  // Look for actual renewal attempts and successes
  lines.forEach(line => {
    // Count certificates that were actually renewed successfully
    if (line.includes('Successfully renewed certificate') || 
        line.includes('Congratulations! Your certificate and chain have been saved')) {
      successfulRenewal++;
    }
    // Count certificates that actually needed renewal (not just processed)
    if (line.includes('Renewing an existing certificate') || 
        line.includes('Attempting to renew cert')) {
      needingRenewal++;
    }
  });

  // If no explicit renewal messages found, check the summary
  if (needingRenewal === 0 && successfulRenewal === 0) {
    lines.forEach(line => {
      // Look for the final summary line
      if (line.includes('renewed,') && line.includes('unchanged,')) {
        const renewedMatch = line.match(/(\d+)\s+renewed/);
        const unchangedMatch = line.match(/(\d+)\s+unchanged/);
        if (renewedMatch) {
          successfulRenewal = parseInt(renewedMatch[1]);
          needingRenewal = successfulRenewal; // If renewed, they needed renewal
        }
      }
    });
  }

  return { needingRenewal, successfulRenewal };
}

async function renewSsl() {
  const log: string[] = [];
  const logAndContinue = (message: string) => {
    console.log(message);
    log.push(message);
  };

  let renewalSuccessful = true;
  let certsPre = '';
  let certsPost = '';

  try {
    logAndContinue('SSL Renewal script started.');

    // 1. Capture cert status BEFORE renewal
    logAndContinue('Getting certificate status before renewal...');
    certsPre = await runCommand('certbot certificates');

    // 2. Stop web server
    let stoppedService = '';
    for (const svc of ['nginx', 'httpd', 'apache2']) {
      try {
        await runCommand(`systemctl is-active --quiet ${svc}`);
        logAndContinue(`Stopping ${svc} to free port 80...`);
        await runCommand(`systemctl stop ${svc}`);
        stoppedService = svc;
        break;
      } catch (error) {
        // service not active or doesn't exist, continue
      }
    }

    // 3. Renew certs
    logAndContinue('Running certbot renew...');
    const certbotRenewOutput = await runCommand(
      'certbot renew --agree-tos --preferred-challenges http-01 --standalone --verbose'
    );
    log.push(certbotRenewOutput);

    // 4. Restart web server
    if (stoppedService) {
      logAndContinue(`Starting ${stoppedService} back up...`);
      await runCommand(`systemctl start ${stoppedService}`);
    }

    // 5. Capture cert status AFTER renewal
    logAndContinue('Getting certificate status after renewal...');
    certsPost = await runCommand('certbot certificates');

    // 6. Build simplified HTML report
    logAndContinue('Building HTML report...');
    const hostname = await runCommand('hostname');
    const date = new Date().toString();
    const { needingRenewal, successfulRenewal } = parseRenewalCounts(certbotRenewOutput);
    const totalCertificates = countTotalCertificates(certsPost);
    const htmlTable = parseCertsToHtml(certsPost); // Show post-renewal status
    
    const htmlReport = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8">
      <style>
        body { font-family:Arial,sans-serif; color:#222; }
        h2 { color:#2a5d84; }
        h3 { color:#2a5d84; }
        table { margin-bottom:24px; }
        th { background:#f0f4f8; }
        td,th { padding:6px 12px; }
      </style>
      </head><body>
        <h2>SSL Renewal Report</h2>
        <p><b>Host:</b> ${hostname}<br><b>Date:</b> ${date}</p>
        
        <p><b>Total certificates:</b> ${totalCertificates}<br>
        <b>Total needing updated:</b> ${needingRenewal}<br>
        <b>Total successfully updated:</b> ${successfulRenewal}</p>
      
        <h3>Certificate Status</h3>
        ${htmlTable}
      </body></html>
    `;

    // 7. Send email
    const recipient = process.env.SMTP_TO_ADDRESS || process.env.SMTP_FROM_ADDRESS;
    if (recipient) {
        logAndContinue(`Sending report to ${recipient}...`);
        const simpleDate = new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        await emailService.sendMail(recipient, `SSL Renewal Report - ${simpleDate}`, htmlReport);
        logAndContinue('Email report sent.');
    } else {
        logAndContinue('SMTP_TO_ADDRESS or SMTP_FROM_ADDRESS not set in .env, skipping email.');
    }
    
    logAndContinue('SSL Renewal script finished successfully.');

  } catch (error) {
    renewalSuccessful = false;
    logAndContinue(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    
    // Send error email with simplified format
    const hostname = await runCommand('hostname').catch(() => 'unknown host');
    const date = new Date().toString();
    const recipient = process.env.SMTP_TO_ADDRESS || process.env.SMTP_FROM_ADDRESS;
    
    if (recipient) {
      const htmlTable = parseCertsToHtml(certsPre); // Show pre-renewal status on failure
      const totalCertificates = countTotalCertificates(certsPre);
      const errorReport = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8">
        <style>
          body { font-family:Arial,sans-serif; color:#222; }
          h2 { color:#d84315; }
          h3 { color:#d84315; }
          table { margin-bottom:24px; }
          th { background:#f0f4f8; }
          td,th { padding:6px 12px; }
        </style>
        </head><body>
          <h2>SSL Renewal Report - FAILED</h2>
          <p><b>Host:</b> ${hostname}<br><b>Date:</b> ${date}</p>
          
          <p><b>Total certificates:</b> ${totalCertificates}<br>
          <b>Total needing updated:</b> Unknown<br>
          <b>Total successfully updated:</b> 0</p>
        
          <h3>Certificate Status</h3>
          ${htmlTable}
        </body></html>
      `;
      
      const simpleDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      await emailService.sendMail(
        recipient,
        `SSL Renewal Report - ${simpleDate} - FAILED`,
        errorReport
      ).catch(emailError => console.error('Failed to send error email', emailError));
    }
  }
}

renewSsl();