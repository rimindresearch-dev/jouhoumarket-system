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
  const [generateLoading, setGenerateLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

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

  // その場で「今すぐ執筆（APIキック）」を実行する新機能！
  async function handleGenerate(titleId: string) {
    if (!secret) {
      alert('エラー：シークレットキーを入力してください。');
      return;
    }
    setGenerateLoading(titleId);
    try {
      const res = await fetch(`/api/cron/generate?secret=${secret}`, { method: 'GET' });
      const result = await res.json();
      if (result.success) {
        alert(`記事「${result.title}」の自動執筆が正常に完了しました！`);
        fetchAll();
      } else {
        alert('執筆に失敗しました: ' + (result.error || '不明なエラー'));
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    } finally {
      setGenerateLoading(null);
    }
  }

  // セキュリティ（RLS）制限を回避し、安全な削除API経由で記事を本番から完全に削除
  async function handleDelete(postId: string, title: string) {
    if (!secret) {
      alert('エラー：管理者シークレットキー（SUPABASE_SERVICE_ROLE_KEY）を上の入力欄に入力してください。');
      return;
    }
    if (!confirm(`本当に「${title}」を削除しますか？この操作は取り消せません。`)) return;

    setDeleteLoading(postId);

    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, secret })
      });
      const result = await res.json();
      if (result.success) {
        alert('記事を削除しました。');
        fetchAll();
      } else {
        alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
      }
    } catch (e: any) {
      alert('エラーが発生しました: ' + e.message);
    } finally {
      setDeleteLoading(null);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', color: '#333' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>情報マーケット 管理者ダッシュボード</h1>
        <p style={{ color: '#666', margin: '5px 0 0' }}>タイトルをインプットし、その場で「今すぐ執筆」させることができます。</p>
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
          ※「今すぐ執筆」や「削除」を行うために、ご自身の `sb_secret_...` のキーを入力してください。
        </p>
      </div>
      
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

      {/* 待機中の予約リスト */}
      <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #eee', borderRadius: '12px', backgroundColor: '#fafafa' }}>
        <h3 style={{ margin: '0 0 15px', fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #eaeaea', paddingBottom: '8px' }}>⏳ 待機中のタイトル予約リスト ({queue.length}件)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {queue.length === 0 ? (
            <p style={{ color: '#999', margin: 0, fontSize: '14px' }}>待機中の予約タイトルはありません。上記のフォームからインプットしてください。</p>
          ) : (
            queue.map((q, idx) => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #eaeaea' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{idx + 1}. {q.title}</span>
                <span style={{ fontSize: '11px', color: '#0070f3', fontWeight: 'bold', backgroundColor: '#e0f2fe', padding: '4px 10px', borderRadius: '20px' }}>
                  {idx === 0 ? '◀ 次に自動執筆されるお題' : '待機中'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>公開済みの記事一覧 ({posts.length}件)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {posts.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #eee', borderRadius: '8px' }}>
            <span style={{ fontSize: '14px' }}>{p.title}</span>
            <button onClick={() => handleDelete(p.id, p.title)} disabled={deleteLoading === p.id} style={{ color: '#e11d48', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>
              {deleteLoading === p.id ? '削除中...' : '削除'}
            </button>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '30px', textAlign: 'center' }}><Link href="/" style={{ color: '#0070f3', fontWeight: 'bold', textDecoration: 'none' }}>← サイトの表示を確認する</Link></p>
    </div>
  );
}
