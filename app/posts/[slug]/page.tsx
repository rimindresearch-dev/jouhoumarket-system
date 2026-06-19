// app/posts/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Relational select query: Fetch post, joined category name, and mapped tags concurrently
  const { data: post } = await supabase
    .from('posts')
    .select('*, categories(name), post_tags(tags(name))')
    .eq('slug', slug)
    .single();

  if (!post) notFound();

  // Parse markdown headings and bullet lists dynamically into beautiful styled elements
  const parsedContent = (post.content || '').split('\n').map((line: string, index: number) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      return <h3 key={index} style={{ fontSize: '18px', fontWeight: 'bold', color: '#222', marginTop: '15px', marginBottom: '6px' }}>{trimmed.replace('### ', '')}</h3>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={index} style={{ fontSize: '21px', fontWeight: 'bold', color: '#111', borderLeft: '4px solid #0070f3', paddingLeft: '10px', marginTop: '24px', marginBottom: '10px' }}>{trimmed.replace('## ', '')}</h2>;
    }
    if (trimmed.startsWith('# ')) {
      return <h1 key={index} style={{ fontSize: '24px', fontWeight: 'extrabold', color: '#111', marginTop: '28px', marginBottom: '12px' }}>{trimmed.replace('# ', '')}</h1>;
    }
    if (trimmed.startsWith('- ')) {
      return <li key={index} style={{ marginLeft: '15px', marginBottom: '4px', fontSize: '16px', color: '#333' }}>{trimmed.replace('- ', '')}</li>;
    }
    return trimmed ? <p key={index} style={{ marginBottom: '12px', fontSize: '16px', color: '#333', lineHeight: '1.6' }}>{trimmed}</p> : <div key={index} style={{ height: '6px' }} />;
  });

  // Format dates securely
  const publishDate = new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const updateDate = new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>Home</Link> &gt; {post.title}
      </div>
      
      {/* Category Badge */}
      {post.categories && (
        <span style={{ fontSize: '11px', color: '#0070f3', textTransform: 'uppercase', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '4px' }}>
          {post.categories.name}
        </span>
      )}

      <h1 style={{ fontSize: '28px', marginBottom: '10px', marginTop: '10px', lineHeight: '1.3', fontWeight: 'bold' }}>{post.title}</h1>
      
      {/* Dynamic Published & Updated Dates: Shows 'Updated' only if the post has been edited/modified */}
      <p style={{ color: '#999', fontSize: '13px', margin: '5px 0 20px' }}>
        Published: {publishDate} {publishDate !== updateDate ? ` | Updated: ${updateDate}` : ''}
      </p>

      {post.cover_image_url && (
        <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '20px' }} />
      )}

      <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px', marginBottom: '30px' }}>{parsedContent}</div>

      {/* Relational Tags list mapped as beautiful pills at the bottom */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div style={{ marginBottom: '40px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          {post.post_tags.map((pt: any, i: number) => pt.tags && (
            <span key={i} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>
              #{pt.tags.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}>← Back to Home</Link>
      </div>
    </div>
  );
}