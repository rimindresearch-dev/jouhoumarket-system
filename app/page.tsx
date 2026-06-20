// app/page.tsx
import React from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  // In Next.js 16, searchParams must be awaited asynchronously
  const params = await searchParams;
  const currentPage = Number(params.page || '1');
  
  const postsPerPage = 5; // 1ページあたりの表示件数を5件に制限します
  const start = (currentPage - 1) * postsPerPage;
  const end = start + postsPerPage - 1;

  // Retrieve limited posts from Supabase with exact total count
  const { data: posts, count } = await supabase
    .from('posts')
    .select('*, categories(name)', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(start, end);

  const totalPages = Math.ceil((count || 0) / postsPerPage);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '40px' }}>
        <span style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Journalist Column</span>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', margin: '5px 0' }}>Bob's Daily Insights</h1>
        <p style={{ color: '#555', margin: 0, fontSize: '15px', lineHeight: '1.5' }}>Global search trends and breaking stories, analytically curated by Bob.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        {posts && posts.map((post) => (
          <div key={post.id} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
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
        ))}
      </div>

      {/* Styled Pagination Navigation containing Previous and Next links */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px', marginBottom: '40px' }}>
        {hasPrev ? (
          <Link href={'/?page=' + (currentPage - 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px' }}>← Previous</Link>
        ) : <div />}
        <span style={{ color: '#999', fontSize: '14px' }}>Page {currentPage} of {totalPages}</span>
        {hasNext ? (
          <Link href={'/?page=' + (currentPage + 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px' }}>Next →</Link>
        ) : <div />}
      </div>

      <footer style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <Link href="/privacy" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</Link>
        <span style={{ color: '#ccc', fontSize: '14px' }}>|</span>
        <Link href="/contact" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Contact Us</Link>
      </footer>
    </div>
  );
}
