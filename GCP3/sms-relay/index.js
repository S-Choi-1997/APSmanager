const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aligo-sms-relay' });
});

// SMS relay endpoint
app.post('/sms/send', async (req, res) => {
  try {
    const { key, user_id, sender, receiver, msg, msg_type, title, testmode_yn } = req.body;

    // Validate required fields
    if (!key || !user_id || !sender || !receiver || !msg) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Missing required fields: key, user_id, sender, receiver, msg'
      });
    }

    // Prepare form data for Aligo API
    const formData = new URLSearchParams({
      key,
      user_id,
      sender,
      receiver,
      msg,
    });

    // Add optional parameters
    if (msg_type) formData.append('msg_type', msg_type);
    if (title) formData.append('title', title);
    if (testmode_yn) formData.append('testmode_yn', testmode_yn);

    console.log(`[${new Date().toISOString()}] Sending SMS to ${receiver}`);

    // Forward request to Aligo API
    const aligoResponse = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const aligoResult = await aligoResponse.json();

    console.log(`[${new Date().toISOString()}] Aligo response:`, aligoResult);

    // Return Aligo's response
    res.json(aligoResult);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    res.status(500).json({
      error: 'relay_error',
      message: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMS Relay Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SMS endpoint: http://localhost:${PORT}/sms/send`);
});
