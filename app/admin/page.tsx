// app/admin/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [bulkTitles, setBulkTitles] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data: p } = await supabase.from('posts').select('*').order('published_at', { ascending: false });
    const { data: q } = await supabase.from('title_queue').select('*').order('created_at', { ascending: true });
    if (p) setPosts(p);
    if (q) setQueue(q);
  }

  // タイトルの一括登録
  async function handleAddTitles() {
    if (!bulkTitles.trim()) {
      alert('エラー：登録するタイトルを入力してください。');
      return;
    }
    setLoading(true);
    const titleList = bulkTitles.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const inserts = titleList.map(t => ({ title: t }));
    const { error } = await supabase.from('title_queue').insert(inserts);
    if (error) alert('登録エラー: ' + error.message);
    else {
      alert(titleList.length + '件のタイトルを予約リストに追加しました！');
      setBulkTitles('');
      fetchAll();
    }
    setLoading(false);
  }

  async function handleDelete(postId: string) {
    if (!confirm('本当にこの記事を削除しますか？')) return;
    await supabase.from('post_tags').delete().eq('post_id', postId);
    await supabase.from('posts').delete().eq('id', postId);
    fetchAll();
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>情報マーケット 管理者ダッシュボード</h1>
        <p style={{ color: '#666', margin: '5px 0 0' }}>渾身のタイトルを予約し、自動執筆させることができます。</p>
      </header>
      
      {/* タイトル一括登録フォーム */}
      <div style={{ backgroundColor: '#f0f7ff', padding: '25px', borderRadius: '12px', marginBottom: '40px', border: '2px solid #0070f3' }}>
        <h2 style={{ margin: '0 0 15px', fontSize: '18px', fontWeight: 'bold' }}>📝 書きたいタイトルを1行ずつ一気に入力</h2>
        <textarea 
          placeholder="1行に1タイトルずつ入力してください。例：&#13;&#10;ChatGPTで月5万稼いだ方法&#13;&#10;なぜ私は副業に失敗したか"
          value={bulkTitles}
          onChange={(e) => setBulkTitles(e.target.value)}
          style={{ width: '100%', height: '180px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <button onClick={handleAddTitles} disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
          {loading ? '登録中...' : 'これらのタイトルを予約リスト（キュー）に追加する'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <div style={{ flex: '1 1 300px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fafafa' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 'bold' }}>待機中のタイトル予約リスト ({queue.length}件)</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {queue.map((q, idx) => (
              <div key={q.id} style={{ fontSize: '13px', color: '#555', padding: '6px', borderBottom: '1px solid #eee' }}>
                {idx + 1}. {q.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>公開済みの記事一覧 ({posts.length}件)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {posts.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #eee', borderRadius: '8px' }}>
            <span style={{ fontSize: '14px' }}>{p.title}</span>
            <button onClick={() => handleDelete(p.id)} style={{ color: '#e11d48', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>削除</button>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '30px', textAlign: 'center' }}><Link href="/" style={{ color: '#0070f3', fontWeight: 'bold', textDecoration: 'none' }}>← サイトの表示を確認する</Link></p>
    </div>
  );
}
