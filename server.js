require('dotenv').config();
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream('log.txt', { flags: 'a' });
const logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = console.log;

console.log('Loaded environment variables');

const express = require('express');
console.log('Loaded express');

const stripe = require('stripe')(process.env.stripeSk);
console.log('Loaded stripe');

const bodyParser = require('body-parser');
console.log('Loaded body-parser');

const cors = require('cors'); // Make sure to install this package
console.log('Loaded cors');

const morgan = require('morgan');
console.log('Loaded morgan');

const path = require('path');
console.log('Loaded path');

const app = express();
console.log('Created express app');

// This will enable CORS for all resources on your server
app.use(cors());
console.log('Enabled CORS');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
console.log('Configured body-parser');

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
console.log('Created write stream');

// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))
console.log('Configured morgan');

app.post('/create-checkout-session', async (req, res) => {
  console.log('Received POST request at /create-checkout-session');
  const site_id = req.query.site_id;

  try {
    console.log('Creating checkout session');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{price: process.env.stripeProPlanPriceId, quantity: 1}],
      mode: 'subscription',
      success_url: `https://app.legis.live/custom-domain-deployment/${site_id}`
    });
    console.log('Checkout session created');

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook', bodyParser.raw({type: 'application/json'}), (request, response) => {
  console.log('Received POST request at /webhook');
  let event;

  try {
    console.log('Constructing webhook event');
    event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], process.env.stripeWebhookSecret);
  } catch (err) {
    console.error(err);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Checkout session completed');
    console.log(JSON.stringify(session));
  }

  response.json({received: true});
});

app.get('/check-subscription', async (req, res) => {
  console.log('Received GET request at /check-subscription');
  // Get the email from the query parameters
  const email = req.query.email;

  console.log('Iterating through the list of stripe customers');
  const customers = await stripe.customers.list({ email: email });
  if (customers.data.length === 0) {
    console.log('No customers found');
    return res.json({ hasActiveSubscription: false });
  }
  const customer = customers.data[0];

  console.log('Looking for this specific customer');
  const subscriptions = await stripe.subscriptions.list({ customer: customer.stripeCustomerId });
  console.log('Looked for this specific customer');

  console.log('Checking subscription status');
  const activeSubscription = subscriptions.data.find(sub => sub.status === 'active');
  console.log('Checked subscription status');
  res.json({ hasActiveSubscription: !!activeSubscription });
});

app.listen(4242, () => console.log('Running on port 4242'));
