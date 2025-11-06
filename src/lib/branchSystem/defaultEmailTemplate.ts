/**
 * Default email template for branch notifications
 * Styled like the thuisbatterij template
 */

export const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      margin-bottom: 30px;
    }
    .lead-card {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
    }
    .lead-name {
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    .lead-info {
      display: flex;
      align-items: center;
      margin: 8px 0;
      font-size: 14px;
    }
    .icon {
      margin-right: 8px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin-top: 20px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">🎉 Nieuwe Lead Binnengekomen!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Je hebt een nieuwe warme lead ontvangen</p>
  </div>
  
  <p>Hallo {{customerName}},</p>
  
  <p>Goed nieuws! Er is een nieuwe lead binnengekomen in je leadportaal:</p>
  
  <div class="lead-card">
    <div class="lead-name">{{leadName}}</div>
    {{#each notificationFields}}
    <div class="lead-info">
      <span class="icon">{{icon}}</span> <strong>{{label}}:</strong> {{{value}}}
    </div>
    {{/each}}
  </div>
  
  <div style="text-align: center;">
    <a href="{{portalLink}}" class="cta-button">
      👉 Bekijk Lead in Portal
    </a>
  </div>
  
  <div style="margin-top: 20px; padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 8px;">
    <p style="margin: 0; color: #856404;">
      <strong>💡 Tip:</strong> Neem zo snel mogelijk contact op met deze lead om je conversiekans te maximaliseren!
    </p>
  </div>
  
  <div class="footer">
    <p>Je ontvangt deze email omdat je email notificaties hebt ingeschakeld voor nieuwe leads.</p>
    <p>Je kunt deze instelling aanpassen in je <a href="https://www.warmeleads.eu/portal">leadportaal instellingen</a>.</p>
    <p style="margin-top: 15px;">
      <strong>WarmeLeads</strong><br>
      De slimste manier om aan leads te komen<br>
      <a href="https://www.warmeleads.eu">www.warmeleads.eu</a>
    </p>
  </div>
</body>
</html>`;

