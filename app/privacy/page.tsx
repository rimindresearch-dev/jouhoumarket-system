// app/privacy/page.tsx
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333', lineHeight: '1.6' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>ホーム</Link> &gt; プライバシーポリシー
      </div>
      <h1 style={{ fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>プライバシーポリシー</h1>
      <p>「情報マーケット」へお越しいただき、誠にありがとうございます。当サイトでは、読者様のプライバシーを尊重し、個人情報の保護を極めて重要な義務と考えております。</p>
      
      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>1. 個人情報の収集について</h2>
      <p>当サイトでは、読者様がお問い合わせフォームをご利用になる際、お名前やメールアドレスをご入力いただく場合がございますが、これらの情報はご質問に対する返信のみに使用し、無断で第三者に開示することは一切ございません。</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>2. クッキーとアクセス解析について</h2>
      <p>当サイトでは、読者様のアクセス動向を分析してサービスを改善するため、Googleアナリティクスなどのアクセス解析ツールを使用し、クッキー（Cookie）を収集する場合がございます。これは匿名で収集されるデータであり、個人を特定するものではありません。ブラウザの設定でクッキーを無効にすることも可能です。</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>3. 広告の配信について</h2>
      <p>当サイトでは、Googleアドセンスなどの第三者配信の広告サービスを利用する場合がございます。これらのサービスは、読者様が当サイトや他のウェブサイトを訪れた過去の記録に基づき、関心のある広告を表示するためにクッキーを使用することがあります。</p>

      <h2 style={{ fontSize: '20px', marginTop: '20px' }}>4. お問い合わせ先</h2>
      <p style={{ marginBottom: '40px' }}>本ポリシー、または当サイトの個人情報保護に関するご質問は、お問い合わせフォームよりコウジ（エディター）までご連絡ください。</p>

      {/* Back to Home Button */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← ホームへ戻る</Link>
      </div>
    </div>
  );
}
