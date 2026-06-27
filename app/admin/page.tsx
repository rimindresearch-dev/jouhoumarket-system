// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 記事一覧を取得
  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('published_at', { ascending: false });
    
    if (!error && data) {
      setPosts(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  // 削除ボタンクリック時の処理
  async function handleDelete(postId: string, title: string) {
    if (!secret) {
      alert('エラー：管理者シークレットキー（SUPABASE_SERVICE_ROLE_KEY）を入力してください。');
      return;
    }

    if (!confirm(`本当に「${title}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    setActionLoading(postId);

    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, secret })
      });

      const result = await res.json();

      if (result.success) {
        alert('記事を削除しました。');
        fetchPosts(); // リストを再読込
      } else {
        alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
      }
    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>情報マーケット 管理用ダッシュボード</h1>
        <p style={{ color: '#666', margin: '5px 0 0' }}>不要な自動生成記事の管理および削除を行えます。</p>
      </header>

      {/* Security Input Card */}
      <div style={{ backgroundColor: '#fafafa', borderRadius: '8px', padding: '20px', border: '1px solid #eee', marginBottom: '30px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#444', display: 'block', marginBottom: '8px' }}>
          管理者シークレットキーを入力してください（SUPABASE_SERVICE_ROLE_KEY）：
        </label>
        <input 
          type="password" 
          placeholder="ey..." 
          value={secret} 
          onChange={(e) => setSecret(e.target.value)} 
          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '14px' }}
        />
        <p style={{ color: '#888', fontSize: '12px', margin: '6px 0 0' }}>
          ※お使いの .env.local にある `SUPABASE_SERVICE_ROLE_KEY` を入力することで、安全に削除処理をキックできます。
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>公開済みの記事一覧 ({posts.length}件)</h2>
        <button 
          onClick={fetchPosts} 
          style={{ padding: '8px 15px', backgroundColor: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
        >
          一覧を更新
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>記事一覧を読み込み中...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>
          公開中の記事はありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {posts.map((post) => (
            <div 
              key={post.id} 
              style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fff' }}
            >
              {post.cover_image_url && (
                <img 
                  src={post.cover_image_url} 
                  alt="" 
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, backgroundColor: '#f5f5f5' }} 
                />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', margin: '0 0 5px', fontWeight: 'bold' }}>{post.title}</h3>
                <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                  公開日: {new Date(post.published_at).toLocaleString('ja-JP')} | スラッグ: {post.slug}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(post.id, post.title)}
                disabled={actionLoading === post.id}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: actionLoading === post.id ? '#ccc' : '#e11d48', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold', 
                  fontSize: '13px' 
                }}
              >
                {actionLoading === post.id ? '削除中...' : '削除'}
              </button>
            </div>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}>← ブログトップへ戻る</Link>
      </footer>
    </div>
  );
}
