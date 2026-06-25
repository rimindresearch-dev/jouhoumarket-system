// app/about/page.tsx
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333', lineHeight: '1.6' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>ホーム</Link> &gt; 運営者情報
      </div>
      
      {/* Koji's Profile Header */}
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <img 
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop" 
          alt="コウジ" 
          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee', flexShrink: 0 }} 
        />
        <div>
          <span style={{ fontSize: '12px', color: '#e11d48', fontWeight: 'bold', textTransform: 'uppercase' }}>チーフエディター</span>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', margin: '2px 0' }}>コウジ (Koji)</h1>
        </div>
      </header>
      
      <p>「<strong>情報マーケット</strong>」にお越しいただき、誠にありがとうございます。運営者の <strong>コウジ（Koji）</strong> です。私は、日本の会社員や主婦の皆様に向けて、15年以上のファイナンシャルプランニング経験を活かし、本当に安全に稼げる在宅ワークや副業情報の分析コラムを日々発信しています。</p>
      <p>現代の激しいトレンドや怪しい情報が飛び交うネット社会において、本当に読者様の役に立つ「お悩み解決型」の道標を、親しみやすい日本語でお届けすることが私の使命です。確定申告の方法や、詐欺に引っかからないためのノウハウを含め、実践的なロードマップを提供します。</p>
      <p style={{ marginBottom: '40px' }}>このブログが、あなたの新しい一歩や、より豊かなライフスタイルのきっかけになることを心から願っております。</p>
      
      {/* Back to Home Button */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← ホームへ戻る</Link>
      </div>
    </div>
  );
}
