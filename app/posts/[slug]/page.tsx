// app/posts/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: post } = await supabase.from('posts').select('*').eq('slug', slug).single();
  if (!post) notFound();

  // Premium inline markdown compiler to parse headings and bullet points dynamically into styled React elements
  const parsedContent = (post.content || '').split('\n').map((line: string, index: number) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      return <h3 key={index} style={{ fontSize: '18px', fontWeight: 'bold', color: '#222', marginTop: '20px', marginBottom: '8px' }}>{trimmed.replace('### ', '')}</h3>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={index} style={{ fontSize: '23px', fontWeight: 'bold', color: '#111', borderLeft: '4px solid #0070f3', paddingLeft: '12px', marginTop: '28px', marginBottom: '12px', lineHeight: '1.4' }}>{trimmed.replace('## ', '')}</h2>;
    }
    if (trimmed.startsWith('# ')) {
      return <h1 key={index} style={{ fontSize: '26px', fontWeight: 'extrabold', color: '#111', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>{trimmed.replace('# ', '')}</h1>;
    }
    if (trimmed.startsWith('- ')) {
      return <li key={index} style={{ marginLeft: '20px', marginBottom: '6px', fontSize: '17px', color: '#333' }}>{trimmed.replace('- ', '')}</li>;
    }
    return trimmed ? <p key={index} style={{ marginBottom: '16px', fontSize: '17px', color: '#333', lineHeight: '1.7' }}>{trimmed}</p> : <div key={index} style={{ height: '8px' }} />;
  });

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>Home</Link> &gt; {post.title}
      </div>
      <h1 style={{ fontSize: '32px', marginBottom: '10px', lineHeight: '1.3', fontWeight: 'bold' }}>{post.title}</h1>
      <p style={{ color: '#666', fontStyle: 'italic', marginBottom: '20px', fontSize: '15px', lineHeight: '1.4' }}>{post.summary}</p>
      
      {post.cover_image_url && (
        <img src={post.cover_image_url} alt="" style={{ width: '100%', height: 'auto', borderRadius: '8px', marginBottom: '20px' }} />
      )}
      
      <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px', marginBottom: '30px' }}>{parsedContent}</div>

      {/* Premium Bottom Ad Slot before footer navigation for high CTR */}
      <div style={{ margin: '30px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
        <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Advertisement</span>
        <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
          Sponsored Content
        </div>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← Back to Home</Link>
      </div>
    </div>
  );
}
