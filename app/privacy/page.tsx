// app/privacy/page.tsx
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333', lineHeight: '1.6' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>Home</Link> &gt; Privacy Policy
      </div>
      <h1 style={{ fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Privacy Policy</h1>
      <p>Welcome to our AI Automated Blog. Your privacy is critically important to us.</p>
      
      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>1. Information We Collect</h2>
      <p>We do not collect any personal data from our visitors unless voluntarily provided through comments or contact forms.</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>2. Cookies and Analytics</h2>
      <p>This site may use standard cookies and analytics tools (such as Google Analytics) to improve user experience.</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>3. Advertisements</h2>
      <p>We may display third-party advertisements (such as Google AdSense) which may use cookies to serve ads based on prior visits.</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>4. Contact</h2>
      <p style={{ marginBottom: '40px' }}>For any questions regarding this policy, please contact us via our official channels.</p>

      {/* Back to Home Button */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← Back to Home</Link>
      </div>
    </div>
  );
}
