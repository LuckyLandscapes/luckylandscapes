// Public privacy notice for app.luckylandscapes.com — the customer-facing
// surfaces (/pay, /quote, /sign) collect PII and process payments, so they need
// a reachable, accurate privacy policy. Kept deliberately in sync with the
// marketing-site policy (luckylandscapes.com/privacy) but scoped to the app.

export const metadata = {
  title: 'Privacy Policy — Lucky Landscapes',
  description: 'How Lucky Landscapes LLC collects, uses, and protects your information in our customer portal.',
};

const wrap = { maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1f2421', lineHeight: 1.65 };
const h1 = { fontSize: 28, fontWeight: 800, margin: '0 0 4px' };
const h2 = { fontSize: 18, fontWeight: 700, margin: '28px 0 8px' };
const muted = { color: '#677160', fontSize: 13 };

export default function AppPrivacyPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={muted}>Lucky Landscapes LLC · Lincoln, NE · Last updated June 21, 2026</p>

      <h2 style={h2}>About this notice</h2>
      <p>This policy covers <strong>app.luckylandscapes.com</strong>, the portal where you review quotes, sign
        agreements, and pay invoices. It is operated by Lucky Landscapes LLC, a Nebraska limited liability company.
        Our main website privacy policy is at <a href="https://luckylandscapes.com/privacy">luckylandscapes.com/privacy</a>.</p>

      <h2 style={h2}>Information we collect</h2>
      <ul>
        <li>Contact details you give us (name, email, phone, property address)</li>
        <li>Project details, quotes, invoices, and any photos tied to your project</li>
        <li>Electronic-signature information when you sign an agreement (your typed/drawn signature, and the date,
          IP address, and browser used — kept as proof the signature is yours)</li>
        <li>Payment details when you pay online — entered directly into our payment processor (Stripe) and never
          stored on our servers</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <p>To prepare and deliver your quote, perform the work, process your deposit and invoice payments, keep records
        required by law, and communicate with you about your project. We do <strong>not</strong> sell, rent, or trade
        your personal information.</p>

      <h2 style={h2}>Service providers</h2>
      <p>We share information only with the providers that run our business, and only as needed:</p>
      <ul>
        <li><strong>Stripe</strong> — card and bank payment processing (<a href="https://stripe.com/privacy" target="_blank" rel="noopener">Stripe privacy policy</a>). We never receive or store your full card number.</li>
        <li><strong>Supabase</strong> — secure database and file storage (hosted on Amazon Web Services)</li>
        <li><strong>Vercel</strong> — application hosting</li>
        <li><strong>Resend</strong> — transactional email (quotes, invoices, signed agreements)</li>
      </ul>

      <h2 style={h2}>Your rights</h2>
      <p>Under the Nebraska Data Privacy Act and similar state laws, you may request to access, correct, or delete your
        personal data, or obtain a copy of it, and you may appeal a declined request. To make a request, contact us
        using the details below; we respond within 30 days.</p>

      <h2 style={h2}>Security &amp; retention</h2>
      <p>We use encrypted (HTTPS) connections and access controls to protect your information, and keep it only as long
        as needed for our services and legal obligations. No method of transmission or storage is 100% secure, so we
        cannot guarantee absolute security.</p>

      <h2 style={h2}>Contact</h2>
      <p>Lucky Landscapes LLC · <a href="mailto:rileykopf@luckylandscapes.com">rileykopf@luckylandscapes.com</a> ·
        (402) 405-5475 · Lincoln, NE</p>

      <p style={{ ...muted, marginTop: 32 }}>
        <a href="/terms">Terms of Service</a>
      </p>
    </main>
  );
}
