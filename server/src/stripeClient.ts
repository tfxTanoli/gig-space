import Stripe from 'stripe';

// Shared Stripe client for controllers that need it (e.g. admin post deletion
// cancelling a post's location subscription). Mirrors the instance in app.ts.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
