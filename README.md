# SSL Certificate Renewal Script

A TypeScript-based automated SSL certificate renewal tool using Certbot with email notifications. This script automatically renews Let's Encrypt SSL certificates, manages web server stops/starts during renewal, and sends concise HTML reports via email.

## Features

- 🔄 Automated SSL certificate renewal using Certbot
- 🌐 Automatic web server management (nginx, httpd, apache2)
- 📧 Clean email notifications with summary reports
- 📊 Certificate renewal count tracking
- 📋 Current certificate status table
- 🔧 Easy configuration via environment variables
- ⏰ Crontab scheduling support
- 🧪 Built-in email testing functionality

## Prerequisites

- **Node.js** (v16 or higher)
- **Certbot** installed and configured
- **systemctl** access (for managing web services)
- **SMTP server** access (Gmail, SendGrid, etc.)
- **Root/sudo privileges** (required for certbot and service management)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd renew-ssl
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment configuration:**
   ```bash
   cp env.sample .env
   ```
   
   Or create a `.env` file with the following variables:
   ```env
   # SMTP Configuration
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=465
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-app-password
   MAIL_ENCRYPTION=ssl
   MAIL_FROM_NAME=SSL Renewal Service
   
   # Email Recipients
   SMTP_TO_ADDRESS=admin@yourdomain.com
   SMTP_FROM_ADDRESS=your-email@gmail.com
   ```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP server port | `465` (SSL) or `587` (TLS) |
| `MAIL_USERNAME` | SMTP username/email | `your-email@gmail.com` |
| `MAIL_PASSWORD` | SMTP password/app password | `your-app-password` |
| `MAIL_ENCRYPTION` | Encryption type | `ssl` or `tls` |
| `MAIL_FROM_NAME` | Display name for sender | `SSL Renewal Service` |
| `SMTP_TO_ADDRESS` | Report recipient email | `admin@yourdomain.com` |
| `SMTP_FROM_ADDRESS` | Sender email (fallback) | `your-email@gmail.com` |

### Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password
   - Use this password in `MAIL_PASSWORD`

## Usage

### Manual Execution

1. **Test email configuration:**
   ```bash
   npm run test:email
   ```

2. **Run SSL renewal:**
   ```bash
   npm start
   ```

   Or with sudo (recommended):
   ```bash
   sudo npm start
   ```

### Build for Production

```bash
npm run build
node dist/index.js
```

## Automated Scheduling with Crontab

To automatically run the SSL renewal script daily:

1. **Edit crontab as root:**
   ```bash
   sudo crontab -e
   ```

2. **Add the following line to run daily at 2:30 AM:**
   ```bash
   30 2 * * * cd /path/to/renew-ssl && /usr/bin/npm start >> /var/log/ssl-renewal.log 2>&1
   ```

3. **Alternative: Run weekly on Sundays at 3:00 AM:**
   ```bash
   0 3 * * 0 cd /path/to/renew-ssl && /usr/bin/npm start >> /var/log/ssl-renewal.log 2>&1
   ```

4. **For more robust logging, create a wrapper script:**
   ```bash
   # Create /usr/local/bin/renew-ssl.sh
   #!/bin/bash
   cd /path/to/renew-ssl
   echo "$(date): Starting SSL renewal" >> /var/log/ssl-renewal.log
   npm start >> /var/log/ssl-renewal.log 2>&1
   echo "$(date): SSL renewal completed" >> /var/log/ssl-renewal.log
   ```

   Make it executable and add to crontab:
   ```bash
   chmod +x /usr/local/bin/renew-ssl.sh
   sudo crontab -e
   # Add: 30 2 * * * /usr/local/bin/renew-ssl.sh
   ```

## How It Works

1. **Pre-renewal Status**: Captures current certificate status
2. **Service Management**: Automatically stops running web servers (nginx, httpd, apache2)
3. **Certificate Renewal**: Runs `certbot renew` with standalone HTTP challenge
4. **Service Restart**: Restarts the previously stopped web server
5. **Post-renewal Status**: Captures updated certificate status
6. **Report Generation**: Creates concise HTML report with renewal counts and current status
7. **Email Notification**: Sends simplified report via configured SMTP server

## Email Report Format

The script sends a clean, concise email report with the following information:

### Successful Renewal Report
- **Subject**: `SSL Renewal Report - Jun 18, 2025 at 1:34 PM`
- **Content**:
  ```
  SSL Renewal Report
  
  Host: your-server-hostname
  Date: [full date and time]
  
  Total certificates: 21
  Total needing updated: 0
  Total successfully updated: 0
  
  Certificate Status
  [Table with Status | Certificate Name | Domains | Expiry Date]
  ```

### Failed Renewal Report
- **Subject**: `SSL Renewal Report - Jun 18, 2025 at 1:34 PM - FAILED`
- **Content**: Same format as above, but shows certificate status before the failed renewal attempt

### Certificate Status Table
The table shows all certificates with:
- **Status**: VALID with days remaining (e.g., "VALID: 84 days")
- **Certificate Name**: The certbot certificate identifier
- **Domains**: All domains covered by the certificate
- **Expiry Date**: When the certificate expires

## Troubleshooting

### Common Issues

**Permission Denied:**
```bash
# Run with sudo
sudo npm start

# Or ensure Node.js/npm are accessible to root
sudo which node
sudo which npm
```

**Certbot Not Found:**
```bash
# Install certbot
sudo apt update
sudo apt install certbot  # Ubuntu/Debian
sudo yum install certbot   # CentOS/RHEL
```

**Email Authentication Failed:**
- Verify SMTP credentials
- For Gmail, ensure App Password is used (not regular password)
- Check firewall settings for SMTP ports

**Web Server Not Stopping:**
- Verify systemctl access: `sudo systemctl status nginx`
- Check if services are running: `sudo systemctl is-active nginx`

### Logs

Check logs for debugging:
```bash
# Crontab logs
tail -f /var/log/ssl-renewal.log

# System logs
journalctl -u cron
sudo journalctl -f
```

## Development

### Scripts

- `npm start` - Run the SSL renewal script
- `npm run test:email` - Test email configuration
- `npm run build` - Compile TypeScript to JavaScript

### File Structure

```
renew-ssl/
├── src/
│   ├── index.ts           # Main renewal script with simplified reporting
│   ├── email.helper.ts    # Email service configuration
│   └── test-email.ts      # Email testing utility
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env                   # Environment configuration (create from env.sample)
└── README.md              # This documentation
```

## Key Features Explained

### Automatic Certificate Counting
The script automatically counts:
- **Total certificates**: All SSL certificates managed by certbot
- **Needing update**: Only certificates that actually require renewal (typically within 30 days of expiration)
- **Successfully updated**: Certificates that were renewed during this run

### Smart Service Management
Automatically detects and manages common web servers:
- Checks for active services: nginx, httpd, apache2
- Stops the running service to free port 80 for certbot
- Restarts the same service after renewal completion

### Simplified Email Reports
- No verbose certbot output cluttering the email
- Clean summary with just the essential information
- Status column positioned first for quick scanning
- Professional email subject formatting

## Security Notes

- Store `.env` file securely and never commit it to version control
- Use App Passwords for email authentication
- Run with minimal required privileges
- Regularly rotate SMTP credentials
- Monitor renewal logs for any issues

## License

ISC License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
