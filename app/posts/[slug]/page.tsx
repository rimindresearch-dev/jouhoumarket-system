// app/posts/[slug]/page.tsx
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '../../../lib/supabase'; // パスが異なる場合は適宜調整してください

export const revalidate = 0;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

// 外部ライブラリ不要で、マークダウンを美しいHTML装飾に変換する軽量パーサー関数
function renderMarkdownToHtml(markdown: string) {
  if (!markdown) return '';
  let html = markdown;

  // 1. 各種見出し（### , ## , # ）を美しい日本語ブログ用のデザインに変換
  html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size: 20px; font-weight: bold; border-left: 4px solid #0070f3; padding-left: 12px; margin: 35px 0 15px; color: #111; letter-spacing: 0.05em;">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #eee; padding-bottom: 8px; margin: 40px 0 20px; color: #111;">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size: 28px; font-weight: bold; margin: 40px 0 20px; color: #111;">$1</h1>');

  // 2. 太字（**テキスト**）を強調タグに変換
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold; color: #000; background: linear-gradient(transparent 70%, #fff3b0 70%); padding: 0 2px;">$1</strong>');

  // 3. 区切り線（---）を上品なデザインに変換
  html = html.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid #eaeaea; margin: 35px 0;" />');

  // 4. リスト（箇条書き・番号付き）を変換
  html = html.replace(/^\d+\.\s(.*)$/gm, '<li style="margin-left: 20px; list-style-type: decimal; margin-bottom: 10px; padding-left: 4px; line-height: 1.7; color: #333;">$1</li>');
  html = html.replace(/^[\*-]\s(.*)$/gm, '<li style="margin-left: 20px; list-style-type: disc; margin-bottom: 10px; padding-left: 4px; line-height: 1.7; color: #333;">$1</li>');

  // 5. 改行と段落を適切にマッピングして読みやすい行間に調整
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height: 15px;"></div>'; // 空行は適度な余白にする
    
    // すでにHTMLタグに変換済みの行はそのまま返す
    if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<li') || trimmed.startsWith('<div')) {
      return line;
    }
    return `<p style="margin: 0 0 18px; line-height: 1.85; color: #333; font-size: 16px; text-align: justify; letter-spacing: 0.03em;">${line}</p>`;
  });

  return processedLines.join('\n');
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const decodedSlug = decodeURIComponent(resolvedParams.slug);
  const encodedSlug = encodeURIComponent(decodedSlug);

  // 一時的なバグ防止のため、該当記事のIDを事前に取得
  const { data: tempPost } = await supabase
    .from('posts')
    .select('id')
    .or(`slug.eq."${decodedSlug}",slug.eq."${encodedSlug}"`)
    .limit(1)
    .maybeSingle();

  const postId = tempPost?.id || '';

  // 記事情報、および関連タグを並行取得（生日本語・%エンコードのどちらでもヒットするORクエリ）
  const [postRes, tagsRes] = await Promise.all([
    supabase.from('posts').select('*, categories(name)').or(`slug.eq."${decodedSlug}",slug.eq."${encodedSlug}"`).maybeSingle(),
    supabase.from('post_tags').select('tags(name, slug)').eq('post_id', postId)
  ]);

  const post = postRes.data;
  if (!post) {
    notFound();
  }

  const tags = tagsRes.data || [];

  return (
    <div style={{ maxWidth: '750px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      
      {/* Breadcrumb Path */}
      <div style={{ marginBottom: '20px', color: '#666', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#666', textDecoration: 'none' }}>ホーム</Link>
        <span style={{ margin: '0 8px' }}>&gt;</span>
        <span style={{ color: '#0070f3', fontWeight: 'bold' }}>{post.categories?.name || '副業コラム'}</span>
      </div>

      <article>
        {/* Editorial Meta */}
        <span style={{ fontSize: '12px', color: '#0070f3', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {post.categories?.name || '副業ノウハウ'}
        </span>
        
        {/* Title */}
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', margin: '10px 0 15px', lineHeight: '1.35', letterSpacing: '-0.02em' }}>
          {post.title}
        </h1>

        {/* Date */}
        <div style={{ color: '#888', fontSize: '13px', marginBottom: '30px' }}>
          公開日: {new Date(post.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {/* Cover Image */}
        {post.cover_image_url && (
          <img 
            src={post.cover_image_url} 
            alt="" 
            style={{ width: '100%', height: 'auto', maxHeight: '420px', objectFit: 'cover', borderRadius: '12px', marginBottom: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }} 
          />
        )}

        {/* Beautiful Styled Markdown Content Body */}
        <div 
          style={{ marginBottom: '60px' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.content) }} 
        />
        
        {/* Tag Badges */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
            {tags.map((t: any, idx) => (
              t.tags && (
                <span 
                  key={idx} 
                  style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  #{t.tags.name}
                </span>
              )
            ))}
          </div>
        )}
      </article>

      {/* Footer Navigation */}
      <footer style={{ borderTop: '2px solid #eee', paddingTop: '30px', textAlign: 'center', marginTop: '60px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '15px' }}>
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
