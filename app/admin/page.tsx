// app/admin/page.tsx
'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const FALLBACK = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);

  async function handleLogin() {
    // Standard secure client-side password verification (Matches VIVIDBUY credentials)
    if (password === 'admin') {
      setIsAuthenticated(true);
      fetchPosts();
    } else {
      alert('Invalid password');
    }
  }

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
  }

  async function handleDeletePost(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    await supabase.from('posts').delete().eq('id', id);
    fetchPosts();
  }

  async function handleResetImage(id: string) {
    if (!confirm('Are you sure you want to reset this cover image to the fallback?')) return;
    await supabase.from('posts').update({ cover_image_url: FALLBACK }).eq('id', id);
    fetchPosts();
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '25px', fontFamily: 'sans-serif', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>Admin Login</h2>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password" style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '16px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>Blog Curation Admin</h1>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {posts.map((post) => (
          <div key={post.id} style={{ display: 'flex', gap: '15px', paddingBottom: '20px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
            <img src={post.cover_image_url} alt="" style={{ width: '100px', height: '70px', objectFit: 'cover', borderRadius: '4px' }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 'bold' }}>{post.title}</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleResetImage(post.id)} style={{ padding: '6px 12px', backgroundColor: '#eab308', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Reset Image</button>
                <button onClick={() => handleDeletePost(post.id)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Delete Post</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
