# 1. 新しい記事の構成テンプレートに100%準拠した自動生成プログラム（route.ts）を定義します
$RouteCode = @'
// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// AIが最先端の副業を発明するための「大カテゴリ（シード）」
const AI_SEED_CATEGORIES = [
  'AI動画クリエイター（TikTok, YouTube Shorts, HeyGen, CapCut）',
  'AI画像・グラフィックデザイン（Midjourney, Canva, バナーデザイン, ロゴ制作）',
  'AIテキストライティング（SEOブログ, クラウドソーシング, 電子書籍, 校正）',
  'AI音声・音楽配信（音声データ入力, ボイスオーバー, Suno, ポッドキャスト）',
  'AI翻訳・ローカライズ（多言語サイト制作, 字幕代行, 翻訳ライティング）',
  'AIプログラミング・ノーコード（LP制作, WEBツール開発, Shopify構築）',
  'Notion・業務効率化テンプレート（Notion販売, デジタルプランナー, Zapier自動化）',
  'AIデジタル電子書籍出版（Kindle絵本, 教材作成, ChatGPTノウハウ本）'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const seed = Math.floor(Math.random() * 9999999);

    // ==========================================
    // 【通信1：エージェントBさん】
    // 最先端AI副業の「具体的で読者を引きつける記事タイトル」と「カテゴリ」「英語スラッグ」の企画に特化
    // ==========================================
    let bData: { title: string; category: string; slug: string; imagePrompt: string } | null = null;
    
    try {
      const bPrompt = 'You are Agent B, the chief AI Trend Researcher and chief editor in Japan. ' +
        'Your job is to invent ONE extremely specific, highly practical, and trendy AI/automation-related side-hustle article title for 2026. ' +
        'CRITICAL RULE: The title MUST use concrete numbers, earning data, or a shocking/surprising hook (e.g. "ChatGPTを使って完全未経験から初月5万円稼いだ具体的な手順", "なぜ私は画像生成AIの副業で一度失敗したのか？真実のロードマップ"). ' +
        'Output strictly a raw JSON object matching this schema: ' +
        '{"title": "Shocking or Concrete Japanese Title with Numbers", "category": "Japanese Category Name", "slug": "english-url-safe-slug-using-hyphens", "imagePrompt": "A highly detailed English image prompt representing the unique theme of the article, highly detailed, 3D render"}';

      const bTextResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: bPrompt }
          ],
          model: 'openai',
          jsonMode: true
        })
      });

      if (bTextResponse.ok) {
        const rawJsonText = await bTextResponse.text();
        const startIndex = rawJsonText.indexOf('{');
        const endIndex = rawJsonText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
          bData = JSON.parse(rawJsonText.substring(startIndex, endIndex + 1));
        }
      }
    } catch (e) {
      console.warn('Agent B failed to brainstorm topic. Using fallback topic.');
    }

    // Bさんが失敗した場合は、予備のテーマを適用
    const finalBData = bData || {
      title: 'ChatGPTを使って完全未経験から副業初月に5万円を稼ぎ出した具体的な手順',
      category: 'ネットビジネス',
      slug: 'chatgpt-side-hustle-5ten-thousand',
      imagePrompt: 'A beautiful bright modern office setup with dual monitors, clean coding lines, 3D render, warm lighting'
    };

    // ==========================================
    // 【通信2：エージェントCさん（執筆コウジ）】
    // Bさんの考案したタイトルに基づき、指定の「6段階テンプレート」に従って魂のコラムを執筆する
    // ==========================================
    const sysPrompt = 'You are Koji (Cさん), a friendly, honest, and expert personal finance and AI automation side-hustle advisor in Japan. ' +
      `Your planning team (Agent B) has given you the article title: "${finalBData.title}". ` +
      'Your absolute mission is to write a highly practical, comprehensive, and engaging Japanese blog article (です・ます調) based on this title. ' +
      'You MUST strictly follow this 6-step article structure template:\n\n' +
      '1) Title & Intro Hook: Start directly with the article body. The very first 3 lines must clearly state WHO this article is for and grab the reader with concrete numbers or surprising hooks. Align perfectly with the search intent.\n' +
      '2) Problem & Empathy (問題提起・共感): Verbally articulate the actual struggles, doubts, and worries that the target reader is currently facing. Make them feel "Koji really understands my pain!" so they do not close the page.\n' +
      '3) Conclusion First (結論を先出し): To prevent bounce rates, clearly state "What you will learn from this article" as a clean bulleted list of 3 to 5 key takeaways. Give them a solid reason to read the rest.\n' +
      '4) Body: Steps/Case Study (本文：ステップ・比較・体験談): Explain the actual step-by-step roadmap or dynamic case study of the side hustle. You MUST name real AI tools (e.g. ChatGPT, Midjourney, CapCut, Suno, Notion, ElevenLabs) and write detailed, concrete workflows.\n' +
      '5) Caution & Failure Patterns (注意点・失敗パターン): To gain massive trust from the readers, write about the common pitfalls, why people fail at this, and how to avoid them. This removes any generic marketing-fluff feel.\n' +
      '6) Summary & Next Actions (まとめ＋次のアクション): Summarize the key points in 3 neat bullet points, and encourage the reader to take their very first action (such as trying a free tool, visiting the contact form, or reading another guide).\n\n' +
      'STRICT FORMAT RULE: Output ONLY the raw Markdown article text (minimum 600 words). Do not output JSON. Do not wrap in markdown codeblocks. Do not include H1 tag for the title since it is already rendered by the page layout. Start directly with the content. Seed: ' + seed;

    const userPrompt = `Please write the complete, masterpiece side-hustle guide article following the 6-step template based on the title: "${finalBData.title}".`;
    let articleContent = '';

    try {
      const cTextResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: 'openai',
          seed: seed
        })
      });

      if (cTextResponse.ok) {
        articleContent = (await cTextResponse.text()).trim();
        // 前後にマークダウンブロック ``` や ```html が入ってしまった場合のクレンジング
        articleContent = articleContent.replace(/^```[a-zA-Z]*/gm, '').replace(/```$/gm, '').trim();
      } else {
        throw new Error('Agent C (Koji) failed to respond.');
      }
    } catch (apiError) {
      console.warn('Agent C failed to write. Generating fallback markdown.');
      articleContent = `### 1. タイトル＆冒頭フック\n\n完全未経験からでも、最新のAIツールを活用すれば「副業初月で5万円」は十分に狙える現実的な数字です。この記事は、「スキルがないから在宅ワークは無理」と諦めているあなたのためのロードマップです。`;
    }

    // 3. 重複ガード（タイトル）
    const { data: dup } = await supabaseAdmin.from('posts').select('id').eq('title', finalBData.title).limit(1).maybeSingle();
    if (dup) return NextResponse.json({ success: true, message: 'Duplicate post skipped' });

    // スラッグが既存のものと重複する場合はランダムな末尾を付与
    let slug = finalBData.slug.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '');
    const { data: dupSlug } = await supabaseAdmin.from('posts').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (dupSlug) {
      slug = slug + '-' + Math.floor(Math.random() * 1000);
    }

    // 4. カバー画像を生成してCloudflare R2にアップロード（ファイル名は英数字のみ）
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    try {
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(finalBData.imagePrompt + ', modern design style, vibrant masterpiece, high res') + '?width=1024&height=576&nologo=true&seed=' + seed;
      const imgRes = await fetch(imgUrl);
      
      if (imgRes.ok) {
        const filename = 'blog-covers/' + seed + '-' + Math.floor(Math.random() * 1000) + '.webp';
        await r2Client.send(new PutObjectCommand({ 
          Bucket: process.env.R2_BUCKET_NAME, 
          Key: filename, 
          Body: Buffer.from(await imgRes.arrayBuffer()), 
          ContentType: 'image/webp' 
        }));
        coverUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL + '/' + filename;
      }
    } catch { 
      console.warn('Using fallback image due to fetch/upload failure'); 
    }

    // 5. カテゴリの取得または新規作成
    let catId: string;
    const categoryName = finalBData.category || '副業ノウハウ';
    const catSlug = encodeURIComponent(categoryName.toLowerCase());

    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).limit(1).maybeSingle();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin.from('categories').insert({ name: categoryName, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCategory.id;
    }

    // 6. Supabaseに記事データを保存
    const { error: postError } = await supabaseAdmin.from('posts').insert({
      title: finalBData.title, 
      slug: slug, 
      summary: finalBData.title + 'をテーマに、AIを活用して初心者から安全に稼ぎ出す手順を、副業アドバイザーコウジがロードマップ形式で分かりやすく解説します。', 
      content: articleContent, 
      cover_image_url: coverUrl, 
      category_id: catId, 
      status: 'published', 
      published_at: new Date().toISOString()
    });
    
    if (postError) throw postError;

    return NextResponse.json({ success: true, data: { source: 'new_template_agent_pipeline', title: finalBData.title, slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 緊急用フォールバック
function generateFallbackPayload() {
  return {
    title: 'ChatGPTを使って完全未経験から副業初月に5万円を稼ぎ出した具体的な手順',
    category: '副業ノウハウ',
    slug: 'chatgpt-side-hustle-fallback-' + Math.floor(Math.random() * 1000),
    imagePrompt: 'A beautiful workspace theme with neon colors'
  };
}
'@

# 2. 安全に上書き保存を実行します
$RouteCode | Out-File -LiteralPath "app/api/cron/generate/route.ts" -Encoding utf8