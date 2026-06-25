// app/contact/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('inquiries')
      .insert([{ name, email, message }]);

    setLoading(false);
    if (error) {
      alert('送信時にエラーが発生しました: ' + error.message);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333', lineHeight: '1.6' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>ホーム</Link> &gt; お問い合わせ
      </div>
      <h1 style={{ fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px', fontWeight: 'bold' }}>お問い合わせ</h1>
      
      {submitted ? (
        <div style={{ margin: '35px 0', padding: '20px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>送信が完了しました！</h2>
          <p style={{ margin: 0 }}>お問い合わせありがとうございます。コウジ（情報マーケット編集部）より折り返しご連絡いたします。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', margin: '25px 0' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>お名前</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '15px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>メールアドレス</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '15px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>お問い合わせ内容</label>
            <textarea required value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', height: '120px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '15px', lineHeight: '1.5' }} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '12px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {loading ? '送信中...' : 'メッセージを送信する'}
          </button>
        </form>
      )}

      {/* Back to Home Button */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← ホームへ戻る</Link>
      </div>
    </div>
  );
}
