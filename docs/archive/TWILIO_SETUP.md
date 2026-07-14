# Twilio WhatsApp Business API Setup

## Environment Variables Needed

Add these to your Vercel environment variables:

```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
```

## Twilio Console Configuration

### 1. WhatsApp Sender Configuration
- **WhatsApp Number:** +31850477067
- **Business Display Name:** PakketAdvies
- **Status:** Online ✅
- **Quality Rating:** High ✅

### 2. Webhook URLs to Configure in Twilio Console

**Incoming Messages Webhook:**
```
https://www.warmeleads.eu/api/whatsapp/webhook
```

**Status Callback URL:**
```
https://www.warmeleads.eu/api/whatsapp/webhook
```

**Fallback URL:**
```
https://www.warmeleads.eu/api/whatsapp/webhook
```

### 3. Messaging Service Configuration
- **Messaging Service SID:** MGdd1866d87a5fd62a061cd3a0d35af598
- **Service Name:** warmeleads
- **Use Case:** Notify my users

## How to Configure Webhooks in Twilio Console

1. Go to **Messaging** → **WhatsApp senders**
2. Click on **+31850477067**
3. Scroll to **Messaging Endpoint Configuration**
4. Set **Webhook URL for incoming messages** to: `https://www.warmeleads.eu/api/whatsapp/webhook`
5. Set **Status callback URL** to: `https://www.warmeleads.eu/api/whatsapp/webhook`
6. Set **Fallback URL** to: `https://www.warmeleads.eu/api/whatsapp/webhook`
7. Set all **Webhook methods** to **HTTP Post**
8. Click **Save**

## Testing

1. Enable WhatsApp in CRM Settings
2. Send a test message
3. Check Twilio Console logs for delivery status
4. Check Vercel logs for webhook events

## API Endpoints

- **Send Message:** `POST /api/whatsapp/send`
- **Webhook:** `POST /api/whatsapp/webhook`
- **Health Check:** `GET /api/whatsapp/webhook`






