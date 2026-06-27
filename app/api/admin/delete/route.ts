// app/api/admin/delete/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const { postId, secret } = await req.json();

    // 管理者認証：環境変数のSERVICE_ROLE_KEYと一致するか厳格にチェック
    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: '認証エラー：管理者シークレットキーが一致しません。' }, { status: 401 });
    }

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    // 1. 外部キー制約エラーを防ぐため、該当記事に紐づくタグ情報（post_tags）を先に削除
    await supabaseAdmin.from('post_tags').delete().eq('post_id', postId);

    // 2. 記事本体（posts）を削除
    const { error } = await supabaseAdmin.from('posts').delete().eq('id', postId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Post successfully deleted' });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
