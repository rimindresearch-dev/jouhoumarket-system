// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 文字コードやAIのブレを100%防ぎ、各セクションを安全に切り出すヘルパー関数
function extractPart(text: string, tag: string): string {
  if (!text) return '';
  const tagUpper = `[${tag.toUpperCase()}]`;
  const index = text.toUpperCase().indexOf(tagUpper);
  if (index === -1) return '';

  const start = index + tagUpper.length;
  
  const nextTags = ['[TITLE]', '[SLUG]', '[SUMMARY]', '[CATEGORY]', '[TAGS]', '[IMAGE_PROMPT]', '[CONTENT]'];
  let end = text.length;

  for (const nextTag of nextTags) {
    if (nextTag === tagUpper) continue;
    const nextIndex = text.toUpperCase().indexOf(nextTag, start);
    if (nextIndex !== -1 && nextIndex < end) {
      end = nextIndex;
    }
  }

  return text.substring(start, end).trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in Vercel settings.' }, { status: 500 });
    }

    const seed = Math.floor(Math.random() * 9999999);

    // 1. 予約リスト（title_queue）から一番古い未処理タイトル（ひな型テーマ）を1つ取得
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

    // 2. 指定された「4段階構成テンプレート」に厳格に沿ってコラムを執筆する指示
    const sysPrompt = 'Write a SEO blog format. Your output MUST NOT be JSON. Output raw plain text strictly with the following delimiters. Do not wrap in markdown code blocks. ' +
      'STRICT JOURNALISTIC RULES FOR KOJI: You are Koji, an expert Japanese side-hustle advisor. ' +
      `Your theme today is: "${targetTitle}". ` +
      'Your article content MUST strictly follow this exact 4-step structure in fluent Japanese (です・ます調) with custom attractive headings. ' +
      'Do NOT output literal boilerplate strings like "1. タイトル＆冒頭フック" or "2. 問題提起・共感ゾーン" as the Markdown headings. ' +
      'Instead, you MUST dynamically invent highly specific, catchy, and natural subheadings (using ### ) matching the content of each section.\n\n' +
      '[TITLE]\n' +
      `Generate an extremely catchy, high-converting Japanese article title (including concrete numbers, earning data, or a shocking/surprising hook, e.g., "スマホ1台でできる！ChatGPTを活用してバナー作成代行で毎月3万円を得る方法") based on the raw draft theme: "${targetTitle}". Do NOT use "${targetTitle}" literally; expand it into a masterpiece title.\n` +
      '[SLUG]\n' +
      'Generate a clean, URL-safe slug in English consisting ONLY of lowercase letters, numbers, and hyphens.\n' +
      '[SUMMARY]\n' +
      'Write a catchy 80-character summary.\n' +
      '[CATEGORY]\n' +
      'Choose a natural category (e.g. 在宅ワーク, ネットビジネス, 物販, デザイン副業).\n' +
      '[TAGS]\n' +
      'Write 3 to 5 tags, comma separated.\n' +
      '[IMAGE_PROMPT]\n' +
      'Write a custom, highly specific imagePrompt in English representing the theme of the article (vibrant, modern 3D render illustration, warm lighting, highly detailed).\n' +
      '[CONTENT]\n' +
      'Write the complete article body text (minimum 1000 words) strictly using these 4 functional sections. Write completely unique and valuable content for each section:\n' +
      'Section 1) Introduction & Hook (Heading: None / No Markdown heading needed. Start directly with the hook paragraphs): ' +
      'Write an extremely compelling introduction hook (3 lines or less) for your generated [TITLE]. State clearly WHO this article is for with concrete numbers or surprising facts.\n' +
      'Section 2) Problem & Empathy (Heading: Invent a highly catchy custom heading, e.g., "### 「AIを使えば簡単に稼げる」の甘い罠と、私の手痛い失敗談"): ' +
      'Articulate the target reader\'s real worries. Make them feel "Koji understands me!".\n' +
      'Section 3) Conclusion First (Heading: Invent a highly catchy custom heading, e.g., "### バナーデザイン副業で月15万円を確実に手にするための結論"): ' +
      'A clean bulleted list of 3-5 key takeaways of this article, giving them the reason to read.\n' +
      'Section 4) Body: Steps/Experience (Heading: Invent a highly catchy custom heading, e.g., "### 完全未経験から最短で売上を出すための実践的な3ステップ"): ' +
      'Explain the actual step-by-step roadmap of the side hustle. You MUST name real AI tools (e.g. ChatGPT, Midjourney, CapCut, Suno, Notion, Canva) and write detailed, concrete workflows. Do NOT write any summary or conclusion sections after this.';

    const userPrompt = `Please write the absolute best masterpiece article based on the draft theme: "${targetTitle}" using the 4-step template.`;

    // 3. 【通信】公式の Google Gemini API へ直接アクセス
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: sysPrompt + '\n\n' + userPrompt }]
            }
          ]
        })
      }
    );

    if (!geminiRes.ok) {
      throw new Error('Google Gemini API returned non-OK status: ' + geminiRes.status);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates[0].content.parts[0].text;

    // 自作の安全抽出関数（extractPart）でバグなく正確に切り出し
    const titleStr = extractPart(rawText, 'TITLE') || targetTitle; // AIが考えたタイトルを適用
    let slugStr = (extractPart(rawText, 'SLUG') || 'article-' + seed).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    slugStr = slugStr.substring(0, 150) || 'article-' + seed;

    const summaryStr = extractPart(rawText, 'SUMMARY').substring(0, 240);
    const categoryName = (extractPart(rawText, 'CATEGORY') || '副業ノウハウ').substring(0, 45);
    const catSlug = encodeURIComponent(categoryName.toLowerCase()).substring(0, 200);

    const imagePromptText = extractPart(rawText, 'IMAGE_PROMPT') || `A stunning 3D render illustration representing the workspace theme of ${targetTitle}`;
    const contentStr = extractPart(rawText, 'CONTENT');

    if (!contentStr) {
      throw new Error('AI Content generation failed or was empty.');
    }

    // 4. 画像生成とR2アップロード
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    try {
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(imagePromptText + ', high res, vibrant') + '?width=1024&height=576&nologo=true&seed=' + seed;
      const imgRes = await fetch(imgUrl);
      if (imgRes.ok) {
        const filename = `covers/${seed}.webp`;
        await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: filename, Body: Buffer.from(await imgRes.arrayBuffer()), ContentType: 'image/webp' }));
        coverUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL + '/' + filename;
      }
    } catch (e) { console.warn('Image fail'); }

    // 5. カテゴリの取得または新規作成
    let catId: string;
    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).limit(1).maybeSingle();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin.from('categories').insert({ name: categoryName, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCategory.id;
    }

    const parsedSummary = summaryStr.substring(0, 250);

    // 6. Supabaseへ記事データを保存
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: titleStr,
      slug: slugStr,
      summary: parsedSummary || (titleStr + 'のロードマップを分かりやすく解説します。').substring(0, 240),
      content: contentStr,
      cover_image_url: coverUrl,
      category_id: catId,
      status: 'published',
      published_at: new Date().toISOString()
    }).select('id').single();

    if (postError) throw postError;

    // 7. タグの紐付け処理
    const rawTags = extractPart(rawText, 'TAGS');
    if (rawTags) {
      const parsedTags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
      await Promise.all(parsedTags.map(async (t: string) => {
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

    // 8. 処理が終わったタイトルを予約リストから自動削除
    await supabaseAdmin.from('title_queue').delete().eq('id', queueData.id);

    return NextResponse.json({ success: true, title: titleStr });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（万が一の時用）
function generateFallbackPayload(seedCategory: string, seedNameClean: string) {
  const safeSlug = 'fallback-' + Math.floor(Math.random() * 10000);
  return {
    title: `【AI副業】未経験から月10万稼ぐ！「${seedNameClean}」の実践手順と成功事例`,
    summary: `最新のAI技術である「${seedCategory}」を活用し、初心者でも安全に自宅で収入を得るための具体的な手順と、実際に結果を出した事例を詳しく解説します。`,
    content: `### 1. タイトル＆冒頭フック\n\n「副業初月で10万円を稼ぎ出す」という目標は、最新のAI技術を活用すれば、完全な未経験からでも十分に狙える現実的な数字です。`,
    category: '副業ノウハウ',
    tags: [seedNameClean, 'AI副業', '在宅ワーク', '初心者向け', 'コウジの解説'],
    imagePrompt: `A stunning and high-tech 3D render illustration representing the workspace theme of ${seedNameClean}`
  };
}