// Public terms for app.luckylandscapes.com customer portal. Aligned with the
// signed service agreement (src/lib/contractTemplate.js — Nebraska governing
// law, entire-agreement) so the two never contradict.

export const metadata = {
  title: 'Terms of Service — Lucky Landscapes',
  description: 'Terms governing use of the Lucky Landscapes customer portal, electronic signatures, and online payments.',
};

const wrap = { maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1f2421', lineHeight: 1.65 };
const h1 = { fontSize: 28, fontWeight: 800, margin: '0 0 4px' };
const h2 = { fontSize: 18, fontWeight: 700, margin: '28px 0 8px' };
const muted = { color: '#677160', fontSize: 13 };

export default function AppTermsPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Terms of Service</h1>
      <p style={muted}>Lucky Landscapes LLC · Lincoln, NE · Last updated June 21, 2026</p>

      <h2 style={h2}>1. Who we are</h2>
      <p>This portal (<strong>app.luckylandscapes.com</strong>) is operated by Lucky Landscapes LLC, a Nebraska limited
        liability company (&ldquo;Lucky Landscapes,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using it to review a
        quote, sign an agreement, or make a payment, you agree to these Terms.</p>

      <h2 style={h2}>2. Quotes and the binding agreement</h2>
      <p>Quotes are estimates. The binding contract for any project is the <strong>signed service agreement</strong> you
        review and sign in this portal. If anything in these Terms conflicts with your signed service agreement for a
        specific project, the signed agreement controls.</p>

      <h2 style={h2}>3. Electronic records and signatures</h2>
      <p>You agree to do business with us electronically and that your electronic signature is legally binding, as
        provided by the federal E-SIGN Act and the Nebraska Uniform Electronic Transactions Act. You may request a free
        paper copy of any agreement, and may withdraw consent to electronic records for future documents, by contacting
        us. A copy of each signed agreement is emailed to you and is available to download from this portal.</p>

      <h2 style={h2}>4. Payments</h2>
      <p>Online card and bank payments are processed by <strong>Stripe</strong>; we never receive or store your full card
        number. By submitting a payment you authorize the charge shown. Deposits and balances are billed per your signed
        service agreement. Refunds and cancellations are handled as stated in that agreement — if you have a question,
        call us at (402) 405-5475 before paying.</p>

      <h2 style={h2}>5. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, our liability for any claim relating to this portal or our services
        will not exceed the amount you paid for the service in question. Nothing in these Terms limits liability that
        cannot be limited under Nebraska law.</p>

      <h2 style={h2}>6. Governing law</h2>
      <p>These Terms and any dispute relating to them or to services provided by Lucky Landscapes LLC are governed by the
        laws of the State of Nebraska, without regard to its conflict-of-laws rules. The exclusive venue for any dispute
        is the state or federal courts located in Lancaster County, Nebraska.</p>

      <h2 style={h2}>7. Contact</h2>
      <p>Lucky Landscapes LLC · <a href="mailto:rileykopf@luckylandscapes.com">rileykopf@luckylandscapes.com</a> ·
        (402) 405-5475 · Lincoln, NE</p>

      <p style={{ ...muted, marginTop: 32 }}>
        <a href="/privacy">Privacy Policy</a>
      </p>
    </main>
  );
}
