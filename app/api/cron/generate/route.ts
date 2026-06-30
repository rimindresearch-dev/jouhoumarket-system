// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 予約リスト（title_queue）から一番古い未処理タイトルを1つ取得
    const { data: queueData, error: queueError } = await supabaseAdmin
      .from('title_queue')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!queueData) {
      return NextResponse.json({ success: true, message: '予約リストが空のため、執筆を待機しました。' });
    }

    const targetTitle = queueData.title;
    const seed = Math.floor(Math.random() * 9999999);

    // 2. 指定された「6段階構成テンプレート」に従ってコウジが執筆するよう指示
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (minimum 1000 words)","category":"string","tags":["string"],"imagePrompt":"string"}. ' +
      'STRICT JOURNALISTIC RULES FOR KOJI: You are Koji, an expert Japanese side-hustle advisor. ' +
      `Your theme today is: "${targetTitle}". ` +
      'Your article content MUST strictly follow this exact 6-step structure in fluent Japanese (です・ます調):\n\n' +
      'Step 1) Title & Intro Hook: Start directly with the given title. The first 3 lines must be a powerful "Hook" with concrete numbers or surprising facts. State clearly WHO this is for.\n' +
      'Step 2) Problem & Empathy (問題提起・共感): Articulate the target reader\'s real worries. Make them feel "Koji understands me!".\n' +
      'Step 3) Conclusion First (結論を先出し): A clean bulleted list of 3-5 key takeaways of this article.\n' +
      'Step 4) Body: Steps/Experience (本文：ステップ・比較・体験談): Explain the actual step-by-step roadmap of the side hustle. You MUST name real AI tools (e.g. ChatGPT, Midjourney, CapCut, Suno, Notion) and write detailed, concrete workflows.\n' +
      'Step 5) Caution & Pitfalls (注意点・失敗パターン): Write about why people fail and how to avoid it. Build massive trust.\n' +
      'Step 6) Summary & Action: 3-point summary and a clear first action step for the reader.\n\n' +
      'STRICT SLUG RULE: Small lowercase English letters and hyphens only (e.g., "how-to-earn-50k", "fail-story-ai-hustle").\n' +
      'STRICT IMAGE PROMPT RULE: Custom English prompt representing the article theme (vibrant, 3D render). Seed: ' + seed;

    const userPrompt = `Please write the absolute best masterpiece article for the title: "${targetTitle}" using the 6-step template.`;

    const aiText = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
        model: 'openai',
        json: true // 👈 jsonMode から最新の json パラメータに完全修正
      })
    });

    const rawJsonText = await aiText.text();
    const startIndex = rawJsonText.indexOf('{');
    const endIndex = rawJsonText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) throw new Error('AI Response Error');
    
    // 余計な ```json 等のマークダウンブロックを綺麗に取り除くクレンジング処理
    let cleanJson = rawJsonText.substring(startIndex, endIndex + 1).trim();
    if (cleanJson.startsWith('```')) {
      const match = cleanJson.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (match) cleanJson = match[1].trim();
    }
    const blogData = JSON.parse(cleanJson);

    // 3. 画像生成とR2アップロード
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    try {
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(blogData.imagePrompt + ', high res, vibrant') + '?width=1024&height=576&nologo=true&seed=' + seed;
      const imgRes = await fetch(imgUrl);
      if (imgRes.ok) {
        const filename = `covers/${seed}.webp`;
        await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: filename, Body: Buffer.from(await imgRes.arrayBuffer()), ContentType: 'image/webp' }));
        coverUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL + '/' + filename;
      }
    } catch (e) { console.warn('Image fail'); }

    // 4. カテゴリの取得または新規作成（255制限対応）
    let catId: string;
    const categoryName = (blogData.category || '副業ノウハウ').substring(0, 50);
    const catSlug = encodeURIComponent(categoryName.toLowerCase()).substring(0, 200);

    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).limit(1).maybeSingle();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin.from('categories').insert({ name: categoryName, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCategory.id;
    }

    const parsedSummary = (blogData.summary || '').substring(0, 250);

    // 5. Supabaseへ記事データを保存
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: targetTitle,
      slug: (blogData.slug || 'article-' + seed).toLowerCase().replace(/[^a-z0-9-]+/g, '-').substring(0, 150),
      summary: parsedSummary || (targetTitle + 'のロードマップを分かりやすく解説します。').substring(0, 250),
      content: blogData.content,
      cover_image_url: coverUrl,
      category_id: catId,
      status: 'published',
      published_at: new Date().toISOString()
    }).select('id').single();

    if (postError) throw postError;

    // 6. タグの紐付け処理
    if (Array.isArray(blogData.tags)) {
      await Promise.all(blogData.tags.map(async (t: string) => {
        if (!t) return;
        const tSlug = encodeURIComponent(t.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')).substring(0, 200) || 'tag-' + Math.floor(Math.random() * 1000);
        let tId: string;
        const { data: extTag } = await supabaseAdmin.from('tags').select('id').eq('slug', tSlug).limit(1).maybeSingle();
        if (extTag) {
          tId = extTag.id;
        } else {
          const tagName = t.substring(0, 50);
          const { data: nTag, error: tErr } = await supabaseAdmin.from('tags').insert({ name: tagName, slug: tSlug }).select('id').single();
          if (tErr) throw tErr;
          tId = nTag.id;
        }
        await supabaseAdmin.from('post_tags').insert({ post_id: newPost?.id || '', tag_id: tId });
      }));
    }

    // 7. 処理が終わったタイトルを予約リストから自動削除
    await supabaseAdmin.from('title_queue').delete().eq('id', queueData.id);

    return NextResponse.json({ success: true, title: targetTitle });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
