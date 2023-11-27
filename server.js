require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.stripeSk);
const bodyParser = require('body-parser');
const cors = require('cors'); // Make sure to install this package
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const app = express();

// This will enable CORS for all resources on your server
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))

app.post('/create-checkout-session', async (req, res) => {
  const site_id = req.query.site_id;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{price: process.env.stripeProPlanPriceId, quantity: 1}],
      mode: 'subscription',
      success_url: `https://app.legis.live/custom-domain-deployment/${site_id}`
      // success_url: `https://app.legis.live/custom-domain-deployment/${site_id}`
      // success_url: 'https://app.legis.live/custom-domain-deployment/{CHECKOUT_SESSION_ID}',
      // cancel_url: 'https://app.legis.live/custom-domain-deployment/{CHECKOUT_SESSION_ID}',
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/webhook', bodyParser.raw({type: 'application/json'}), (request, response) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], process.env.stripeWebhookSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Here you can trigger the communication with MongoDB
    // For example, you might call a function like this:
    console.log(JSON.stringify(session));
  }

  response.json({received: true});
});


app.get('/check-subscription', async (req, res) => {
  // Get the email from the query parameters
  const email = req.query.email;

  const customers = await stripe.customers.list({ email: email });
  if (customers.data.length === 0) {
    return res.json({ hasActiveSubscription: false });
  }
  const customer = customers.data[0];

  const subscriptions = await stripe.subscriptions.list({ customer: customer.stripeCustomerId });
  const activeSubscription = subscriptions.data.find(sub => sub.status === 'active');
  res.json({ hasActiveSubscription: !!activeSubscription });
});


app.listen(4242, () => console.log('Running on port 4242'));
