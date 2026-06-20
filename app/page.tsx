// app/page.tsx
import React from 'react';
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
        {posts && posts.map((post, idx) => (
          <React.Fragment key={post.id}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {post.cover_image_url && (
                <img 
                  src={post.cover_image_url} 
                  alt="" 
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} 
                />
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '18px', margin: '0 0 5px', lineHeight: '1.4' }}>
                  <Link href={'/posts/' + post.slug} style={{ color: '#0070f3', textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </h2>
                <p style={{ color: '#666', fontSize: '14px', margin: 0, lineHeight: '1.4' }}>{post.summary}</p>
              </div>
            </div>
            
            {/* Elegant In-Feed Native Ad Slot displayed after the 2nd article */}
            {idx === 1 && (
              <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Advertisement</span>
                <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                  Sponsored Content
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <footer style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <Link href="/privacy" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</Link>
        <span style={{ color: '#ccc', fontSize: '14px' }}>|</span>
        <Link href="/contact" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Contact Us</Link>
      </footer>
    </div>
  );
}
