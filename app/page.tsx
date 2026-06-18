// app/page.tsx
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export const revalidate = 0;

export default async function Page() {
  const { data: posts } = await supabase
    .from('posts')
    .select('*, categories(name)')
    .order('published_at', { ascending: false });

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '40px' }}>
        <span style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Journalist Column</span>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', margin: '5px 0' }}>Bob's Daily Insights</h1>
        <p style={{ color: '#555', margin: 0, fontSize: '15px', lineHeight: '1.5' }}>Global search trends and breaking stories, analytically curated by Bob.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        {posts && posts.map((post) => (
          <div key={post.id} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {post.cover_image_url && (
              <img src={post.cover_image_url} alt="" style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
            )}
            <div>
              <h2 style={{ fontSize: '18px', margin: '0 0 5px' }}>
                <Link href={'/posts/' + post.slug} style={{ color: '#0070f3', textDecoration: 'none' }}>
                  {post.title}
                </Link>
              </h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>{post.summary}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Styled Footer containing Privacy Policy link for Google AdSense compliance */}
      <footer style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', marginTop: '40px' }}>
        <Link href="/privacy" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</Link>
      </footer>
    </div>
  );
}
