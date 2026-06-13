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
      <h1 style={{ fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>AI Blog</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
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
    </div>
  );
}
