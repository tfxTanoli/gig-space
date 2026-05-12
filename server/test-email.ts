/**
 * Manual email test — run with:
 *   npx tsx test-email.ts
 * from inside the server/ directory.
 */
import 'dotenv/config';
import { sendEmailNotification } from './src/email';

const APP_URL = 'http://localhost:5173';

async function main() {
  console.log('\n=== GigSpace Email Notification Tests ===\n');

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 1 — sajalal678@gmail.com
  // Seller received a new offer from a buyer
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📤 Sending Scenario 1 → sajalal678@gmail.com (New Offer)...');
  try {
    await sendEmailNotification(
      'sajalal678@gmail.com',
      'Sajal',
      {
        type: 'offer',
        title: 'You received a new offer!',
        body: 'Usman Tanoli sent you a $120 offer for "Professional Logo Design". Head to your messages to review and respond.',
        senderName: 'Usman Tanoli',
        conversationId: 'conv_test_001',
      }
    );
    console.log('   ✅ Scenario 1 sent successfully!\n');
  } catch (err) {
    console.error('   ❌ Scenario 1 failed:', err instanceof Error ? err.message : err, '\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 2 — usmantan267@gmail.com
  // Buyer's order has been delivered — redirects to buyer dashboard orders tab
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📤 Sending Scenario 2 → usmantan267@gmail.com (Order Delivered)...');
  try {
    await sendEmailNotification(
      'usmantan267@gmail.com',
      'Usman',
      {
        type: 'delivery',
        title: 'Your order has been delivered!',
        body: 'Sajal Al delivered "Professional Logo Design". Review the work and either approve it or request a revision from your dashboard.',
        senderName: 'Sajal Al',
        orderId: 'order_test_002',
      }
    );
    console.log('   ✅ Scenario 2 sent successfully!\n');
  } catch (err) {
    console.error('   ❌ Scenario 2 failed:', err instanceof Error ? err.message : err, '\n');
  }

  console.log('=== Done ===\n');
}

main();
