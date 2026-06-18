// app/contact/page.tsx
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333', lineHeight: '1.6' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>Home</Link> &gt; Contact
      </div>
      <h1 style={{ fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Contact Us</h1>
      <p>If you have any questions, feedback, or inquiries regarding Bob's Daily Insights, please feel free to reach out to us.</p>
      
      <div style={{ margin: '30px 0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 10px', fontWeight: 'bold' }}>Email Inquiry</h2>
        <p style={{ margin: '0 0 15px', color: '#555' }}>You can send us an email directly at:</p>
        <a href="mailto:takahiro999q@gmail.com" style={{ fontSize: '18px', color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}>takahiro999q@gmail.com</a>
      </div>

      <p style={{ fontSize: '14px', color: '#666' }}>We usually respond to all legitimate inquiries within 2-3 business days.</p>
    </div>
  );
}
