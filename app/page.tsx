// app/page.tsx
import React from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentPage = Number(params.page || '1');
  
  const postsPerPage = 5;
  const start = (currentPage - 1) * postsPerPage;
  const end = start + postsPerPage - 1;

  // Retrieve posts and ad settings concurrently
  const [postsRes, adsRes] = await Promise.all([
    supabase.from('posts').select('*, categories(name)', { count: 'exact' }).order('published_at', { ascending: false }).range(start, end),
    supabase.from('settings').select('*')
  ]);

  const posts = postsRes.data;
  const count = postsRes.count;
  const ads = adsRes.data;

  // Extract dynamic AdSense codes or keep placeholders
  const adHomepage = ads?.find(s => s.key === 'ad_code_homepage')?.value || '';
  const adSidebar = ads?.find(s => s.key === 'ad_code_sidebar')?.value || '';

  const totalPages = Math.ceil((count || 0) / postsPerPage);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div style={{ maxWidth: '950px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      
      {/* Editorial Header with Bob's Circular Journalist Avatar */}
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '40px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <img 
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop" 
          alt="Bob" 
          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee', flexShrink: 0 }} 
        />
        <div>
          <span style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Journalist Column</span>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111', margin: '2px 0 4px' }}>Bob's Daily Insights</h1>
          <p style={{ color: '#555', margin: 0, fontSize: '14px', lineHeight: '1.4' }}>Global search trends and breaking stories, analytically curated by Bob.</p>
        </div>
      </header>

      {/* Responsive Two-Column Layout (Main Content + Sidebar) */}
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* Main Column (Left side) - Takes 60% of desktop space */}
        <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
          
          {/* Articles list (Without in-feed ads to ensure smooth reading) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {posts && posts.map((post) => (
              <div key={post.id} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                {post.cover_image_url && (
                  <img 
                    src={post.cover_image_url} 
                    alt="" 
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} 
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '18px', margin: '0 0 5px', lineHeight: '1.4', fontWeight: 'bold' }}>
                    <Link href={'/posts/' + post.slug} style={{ color: '#0070f3', textDecoration: 'none' }}>
                      {post.title}
                    </Link>
                  </h2>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0, lineHeight: '1.4' }}>{post.summary}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Styled Pagination Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px', marginBottom: '30px' }}>
            {hasPrev ? (
              <Link href={'/?page=' + (currentPage - 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>← Previous</Link>
            ) : <div />}
            <span style={{ color: '#999', fontSize: '13px' }}>Page {currentPage} of {totalPages}</span>
            {hasNext ? (
              <Link href={'/?page=' + (currentPage + 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>Next →</Link>
            ) : <div />}
          </div>

          {/* Dynamic Article List Bottom Ad Slot - Positioned safely at the very end of the list */}
          {adHomepage.includes('<!--') ? (
            <div style={{ margin: '30px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>List Bottom Advertisement</span>
              <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                Sponsored Content Space
              </div>
            </div>
          ) : (
            <div style={{ margin: '30px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adHomepage }} />
          )}
        </div>

        {/* Sidebar Column (Right side) */}
        <aside style={{ flex: '1 1 250px', maxWidth: '320px', minWidth: '250px' }}>
          
          {/* Author Card */}
          <div style={{ backgroundColor: '#fafafa', borderRadius: '8px', padding: '20px', border: '1px solid #f0f0f0', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px', borderBottom: '2px solid #eee', paddingBottom: '6px' }}>About Journalist Bob</h3>
            <p style={{ color: '#555', margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
              Bob is a veteran global trend analyst and independent tech journalist. He curates daily breaking search patterns and turns complex data streams into comprehensive, readable human stories.
            </p>
          </div>

          {/* Sticky Sidebar Ad Container */}
          <div style={{ position: 'sticky', top: '20px' }}>
            {adSidebar.includes('<!--') ? (
              <div style={{ padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Sidebar Advertisement</span>
                <div style={{ minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                  Aged Domain Ad Banner Space
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adSidebar }} />
            )}
          </div>
        </aside>

      </div>

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
