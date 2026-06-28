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

  const adHomepage = ads?.find(s => s.key === 'ad_code_homepage')?.value || '';
  const adSidebar = ads?.find(s => s.key === 'ad_code_sidebar')?.value || '';

  const totalPages = Math.ceil((count || 0) / postsPerPage);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div style={{ maxWidth: '950px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      
      {/* Japanese Editorial Header with Koji's Circular Avatar */}
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '40px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <img 
          src="https://image.pollinations.ai/prompt/A%20friendly%20smiling%20Japanese%20male%20personal%20finance%20advisor%20named%20Koji,%2030s,%20short%20clean%20hair,%20wearing%20a%20casual%20shirt,%20circular%20headshot%20profile%20photo,%20white%20studio%20background,%20highly%20detailed?width=150&height=150&nologo=true&seed=9128" 
          alt="Koji" 
          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee', flexShrink: 0 }} 
        />
        <div>
          <span style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>副業・在宅コラム</span>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111', margin: '2px 0 4px' }}>情報マーケット</h1>
          <p style={{ color: '#555', margin: 0, fontSize: '14px', lineHeight: '1.4' }}>副業、在宅ワーク、安全な稼ぎ方を、アドバイザーのコウジが厳選して届けるお宝情報コラムサイト。</p>
        </div>
      </header>

      {/* Responsive Two-Column Layout */}
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* Main Column (Left side) */}
        <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {posts && posts.map((post, idx) => (
              <React.Fragment key={post.id}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  {post.cover_image_url && (
                    <img 
                      src={post.cover_image_url} 
                      alt="" 
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} 
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '17px', margin: '0 0 5px', lineHeight: '1.4', fontWeight: 'bold' }}>
                      <Link href={'/posts/' + post.slug} style={{ color: '#0070f3', textDecoration: 'none' }}>
                        {post.title}
                      </Link>
                    </h2>
                    <p style={{ color: '#666', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>{post.summary}</p>
                  </div>
                </div>
                
                {/* Dynamic In-Feed Ad Slot after the 2nd article */}
                {idx === 1 && (
                  adHomepage.includes('<!--') ? (
                    <div style={{ margin: '15px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>広告スペース (In-Feed Advertisement)</span>
                      <div style={{ minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                        AdSense Ads Space
                      </div>
                    </div>
                  ) : (
                    <div style={{ margin: '15px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adHomepage }} />
                  )
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Styled Pagination Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px', marginBottom: '30px' }}>
            {hasPrev ? (
              <Link href={'/?page=' + (currentPage - 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>← 前のページ</Link>
            ) : <div />}
            <span style={{ color: '#999', fontSize: '13px' }}>ページ {currentPage} / {totalPages}</span>
            {hasNext ? (
              <Link href={'/?page=' + (currentPage + 1)} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>次のページ →</Link>
            ) : <div />}
          </div>

          {/* Dynamic Article List Bottom Ad Slot */}
          {adHomepage.includes('<!--') ? (
            <div style={{ margin: '30px 0', padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>広告スペース (List Bottom Advertisement)</span>
              <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                AdSense Ads Space
              </div>
            </div>
          ) : (
            <div style={{ margin: '30px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adHomepage }} />
          )}
        </div>

        {/* Sidebar Column (Right side) */}
        <aside style={{ flex: '1 1 250px', maxWidth: '320px', minWidth: '250px' }}>
          
          {/* Author Card in Japanese */}
          <div style={{ backgroundColor: '#fafafa', borderRadius: '8px', padding: '20px', border: '1px solid #f0f0f0', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px', borderBottom: '2px solid #eee', paddingBottom: '6px' }}>副業アドバイザー コウジ</h3>
            <p style={{ color: '#555', margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
              コウジは、15年のキャリアを持つ個人財務プランナー兼副業専門ライターです。日々急上昇する検索トレンドや、本当に安全に稼げる最新の在宅ワーク情報を分析し、初心者向けに分かりやすく解説するコラムをお届けしています。
            </p>
          </div>

          {/* Sticky Sidebar Ad Container */}
          <div style={{ position: 'sticky', top: '20px' }}>
            {adSidebar.includes('<!--') ? (
              <div style={{ padding: '15px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>広告スペース (Sidebar Advertisement)</span>
                <div style={{ minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>
                  AdSense Ads Space
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: adSidebar }} />
            )}
          </div>
        </aside>

      </div>

      <footer style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
          <Link href="/privacy" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>プライバシーポリシー</Link>
          <span style={{ color: '#ccc', fontSize: '14px' }}>|</span>
          <Link href="/contact" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>お問い合わせ</Link>
          <span style={{ color: '#ccc', fontSize: '14px' }}>|</span>
          <Link href="/about" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>運営者情報</Link>
        </div>
        <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
          © {new Date().getFullYear()} 情報マーケット. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

