// app/posts/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Retrieve post and ad settings concurrently
  const [postRes, adsRes] = await Promise.all([
    supabase.from('posts').select('*, categories(name), post_tags(tags(name))').eq('slug', slug).single(),
    supabase.from('settings').select('*')
  ]);

  const post = postRes.data;
  const ads = adsRes.data;

  if (!post) notFound();

  // Extract dynamic AdSense code for detail page
  const adDetail = ads?.find(s => s.key === 'ad_code_detail')?.value || '';

  // Premium inline markdown compiler
  const parsedContent = (post.content || '').split('\n').map((line: string, index: number) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      return <h3 key={index} style={{ fontSize: '18px', fontWeight: 'bold', color: '#222', marginTop: '15px', marginBottom: '6px' }}>{trimmed.replace('### ', '')}</h3>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={index} style={{ fontSize: '23px', fontWeight: 'bold', color: '#111', borderLeft: '4px solid #0070f3', paddingLeft: '10px', marginTop: '24px', marginBottom: '10px', lineHeight: '1.4' }}>{trimmed.replace('## ', '')}</h2>;
    }
    if (trimmed.startsWith('# ')) {
      return <h1 key={index} style={{ fontSize: '26px', fontWeight: 'extrabold', color: '#111', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>{trimmed.replace('# ', '')}</h1>;
    }
    if (trimmed.startsWith('- ')) {
      return <li key={index} style={{ marginLeft: '20px', marginBottom: '6px', fontSize: '17px', color: '#333' }}>{trimmed.replace('- ', '')}</li>;
    }
    return trimmed ? <p key={index} style={{ marginBottom: '16px', fontSize: '17px', color: '#333', lineHeight: '1.7' }}>{trimmed}</p> : <div key={index} style={{ height: '8px' }} />;
  });

  const publishDate = new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const updateDate = new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>Home</Link> &gt; {post.title}
      </div>
      
      {post.categories && (
        <span style={{ fontSize: '11px', color: '#0070f3', textTransform: 'uppercase', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '4px' }}>
          {post.categories.name}
        </span>
      )}

      <h1 style={{ fontSize: '32px', marginBottom: '10px', lineHeight: '1.3', fontWeight: 'bold' }}>{post.title}</h1>
      
      <p style={{ color: '#999', fontSize: '13px', margin: '5px 0 20px' }}>
        Published: {publishDate} {publishDate !== updateDate ? ` | Updated: ${updateDate}` : ''}
      </p>

      {post.cover_image_url && (
        <img src={post.cover_image_url} alt="" style={{ width: '100%', height: 'auto', borderRadius: '8px', marginBottom: '20px' }} />
      )}

      <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px', marginBottom: '30px' }}>{parsedContent}</div>

      {/* Relational Tags list */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div style={{ marginBottom: '30px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          {post.post_tags.map((pt: any, i: number) => pt.tags && (
            <span key={i} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>
              #{pt.tags.name}
            </span>
          ))}
        </div>
      )}

      {/* Dynamic Bottom Ad Slot from settings DB */}
      {adDetail.includes('<!--') ? (
        <div style={{ margin: '30px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Advertisement</span>
          <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
            Sponsored Content Space
          </div>
        </div>
      ) : (
        <div style={{ margin: '30px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adDetail }} />
      )}

      {/* Styled Footer containing Privacy Policy, Contact links, and Dynamic Copyright */}
      <footer style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
          <Link href="/privacy" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</Link>
          <span style={{ color: '#ccc', fontSize: '14px' }}>|</span>
          <Link href="/contact" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Contact Us</Link>
        </div>
        <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
          © {new Date().getFullYear()} Bob's Daily Insights. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
