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

    // 1. 今回のAIの「研究テーマ」となる大カテゴリをランダムに1つ選択
    const seedCategory = AI_SEED_CATEGORIES[Math.floor(Math.random() * AI_SEED_CATEGORIES.length)];
    const seedNameClean = seedCategory.split('（')[0]; // 安全なテキスト抽出

    // 2. 超具体的・事実ベースの記事執筆指示（ワンパス・マルチエージェント協調）
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (minimum 600 words)","category":"string","tags":["string"],"imagePrompt":"string"}. ' +
      'STRICT DUAL-AGENT COLLABORATION RULES:\n' +
      '1) Act as AI Agent B (Researcher Brain): First, internally brainstorm and invent one extremely specific, trendy, and highly realistic AI side-hustle concept for 2026 (e.g. using Suno to sell custom sound assets, or using HeyGen to automate recruiting videos, or ChatGPT for local business translation). Avoid generic "blogging" or "freelancing" clichés. This invented concept is your "Research Theme".\n' +
      '2) Act as AI Agent C (Expert Writer Koji): Now, write a masterpiece guide about that "Research Theme" you just invented, strictly from the perspective of Koji, a friendly Japanese side-hustle expert.\n' +
      'Your article content MUST follow this structure in Japanese:\n' +
      '- Introduction & Fact/Case Study: Warmly introduce the specific AI tool/concept. You MUST explain a realistic success case study (e.g. how a complete beginner earned money using this specific tech stack) in fluent Japanese. Give real tool names!\n' +
      '- Required Tools (The Tech Stack): List the exact, real-world AI and digital tools needed (e.g., ChatGPT, Midjourney, CapCut, Suno, Notion) and what they do.\n' +
      '- Actionable Step-by-Step Guide: Write an extremely practical, easy-to-follow, step-by-step Japanese guide on how to actually start, execute, and monetize this specific side gig.\n' +
      '- Safety, Tax & Compliance: Remind readers in Japanese about tax filing (kakutei shinkoku) when side income exceeds 200,000 yen, and warn them to avoid high-priced scams.\n' +
      '- Koji\'s Take: Conclude with Koji\'s encouraging, friendly closing advice in Japanese.\n' +
      'STRICT IMAGE PROMPT RULE: You MUST write a custom, highly specific imagePrompt in English representing the theme of the article. For example, if it is about childrens book publishing, describe colorful illustration book covers on a tablet. If it is about audio synthesized podcasts, describe a premium microphone with neon soundwaves. DO NOT generate simple office desks. ' +
      'STRICT LANGUAGE RULE: You MUST write the entire JSON response (title, summary, content, category, tags) strictly in 100% fluent, natural, professional Japanese (です・ます調). Output raw JSON only. Seed: ' + seed;

    const userPrompt = `Invent an amazing, highly practical AI side-hustle concept based on "${seedCategory}", and write the full Japanese guide in JSON format.`;
    let blogData: any;

    try {
      const aiText = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: 'openai', // 爆速モデル
          jsonMode: true
        })
      });

      if (aiText.ok) {
        // 余分なマークダウンマーク（ ```json ）を削るクレンジング処理
        const rawJsonText = await aiText.text();
        const startIndex = rawJsonText.indexOf('{');
        const endIndex = rawJsonText.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error('No valid JSON found');
        const cleanJson = rawJsonText.substring(startIndex, endIndex + 1);
        blogData = JSON.parse(cleanJson);
      } else {
        throw new Error('AI Server responded with non-OK status');
      }
    } catch (apiError) {
      console.warn('AI生成プロセスでエラーが起きたため、安全用の日本語フォールバックを起動します:', apiError);
      blogData = generateFallbackPayload(seedCategory, seedNameClean);
    }

    // 3. 重複ガード（タイトル）
    const { data: dup } = await supabaseAdmin.from('posts').select('id').eq('title', blogData.title).limit(1).maybeSingle();
    if (dup) return NextResponse.json({ success: true, message: 'Duplicate post skipped' });

    // スラッグが既存のものと重複する場合はランダムな末尾を付与、かつ最大200文字に制限
    let slug = blogData.slug.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '');
    slug = slug.substring(0, 200); // 255文字制限対策の安全切り取り
    
    const { data: dupSlug } = await supabaseAdmin.from('posts').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (dupSlug) {
      slug = (slug.substring(0, 190)) + '-' + Math.floor(Math.random() * 1000);
    }

    // 4. カバー画像を生成してCloudflare R2にアップロード
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    try {
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(blogData.imagePrompt + ', modern design style, vibrant masterpiece, high res') + '?width=1024&height=576&nologo=true&seed=' + seed;
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

    // 255文字制限対策：要約（summary）を最大250文字に制限
    const parsedSummary = (blogData.summary || '').substring(0, 250);

    // 6. Supabaseに記事データを保存し、IDを新しく取得（.select('id').single() を追加してバグを完全解消！）
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: blogData.title, 
      slug: slug, 
      summary: parsedSummary || (blogData.title + 'をテーマに、AIを活用して初心者から安全に稼ぎ出す手順を、副業アドバイザーコウジがロードマップ形式で分かりやすく解説します。').substring(0, 250), 
      content: blogData.content, 
      cover_image_url: coverUrl, 
      category_id: catId, 
      status: 'published', 
      published_at: new Date().toISOString()
    }).select('id').single();
    
    if (postError) throw postError;

    // 7. タグの紐付け処理（newPost.id が安全に機能するようになります）
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

    return NextResponse.json({ success: true, data: { source: 'optimized_one_pass_agent', title: blogData.title, slug: blogData.slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（万が一の時用）
function generateFallbackPayload(seedCategory: string, seedNameClean: string) {
  const safeSlug = encodeURIComponent(seedCategory.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')).substring(0, 200) || 'side-hustle';
  
  const title = `【AI副業】未経験から月10万稼ぐ！「${seedNameClean}」の実践手順と成功事例`;
  const summary = `最新のAI技術である「${seedCategory}」を活用し、初心者でも安全に自宅で収入を得るための具体的な手順と、実際に結果を出した事例を詳しく解説します。`;

  const markdownContent = `### 1. はじめに：AIを活用した「${seedNameClean}」とは？\n\n` +
    `こんにちは！副業アドバイザーのコウジです。最近、インターネットやSNS上で**「${seedCategory}」**というキーワードが大きな注目を集めています。` +
    `実は、こうした急上昇する最新トレンドや話題のテーマには、私たちが在宅ワークや副業で新しい収入源を作るための「ヒント」が隠されています。\n\n` +
    `近年、AI技術の進化によって、これまで専門スキルが必要だったお仕事が、個人が数時間でハイクオリティにこなせる時代が到来しました。実際に、` +
    `副業未経験からスタートした多くのサラリーマンや主婦の方が、AIを相棒にすることで「初月から数万円、3ヶ月以内に月10万円以上」の安定した成果を叩き出しています。\n\n` +
    `---` +
    `\n\n### 2. 稼ぐために必要な「ツールの組み合わせ（Tech Stack）」\n\n` +
    `この副業を成立させるために使用する、具体的かつすべて無料で始められるAI・デザインツールは以下の通りです。\n\n` +
    `1. **文章・企画案の作成：ChatGPT (OpenAI) / Claude**\n` +
    `   * お仕事の台本テキストや、全体の構成案、キャッチコピーの自動作成など「言語化」のすべてを担当します。\n` +
    `2. **デザイン・イラスト生成：Canva / Midjourney / DALL-E 3**\n` +
    `   * 書籍の表紙デザイン、動画用のイラスト素材、おしゃれなバナー画像を数秒で最高品質に生成します。\n` +
    `3. **動画・音声の編集：CapCut / Vrew / ElevenLabs**\n` +
    `   * 綺麗なテロップ（字幕）の自動挿入や、AIによる超リアルな日本語ナレーション（吹き替え）の作成を自動で行います。\n\n` +
    `---` +
    `\n\n### 3. 未経験から収入を得るための「実践ステップ（3ステップ）」\n\n` +
    `自宅から安全に最初の一歩を踏み出すための具体的な流れです。\n\n` +
    `1. **AIツールを実際に触って「サンプル」を作ってみる**\n` +
    `   まずは無料のAIツール（ChatGPTなど）を触り、ご自身で動画のサンプルを3〜5本作成してみます。AIの指示に慣れることが一番の近道です。\n` +
    `2. **クラウドソーシングでの「お仕事獲得」**\n   「クラウドワークス」や「ココナラ」に登録し、作成したサンプルをアピールして、Webライター、ロゴ作成、動画編集などの案件に応募します。AIを使えば数分の一の時間で納品できるため、効率よく高い利益率を確保できます。\n` +
    `3. **自社メディアでの「資産化」**\n   依頼を受けて稼ぐだけでなく、作成した電子書籍をAmazon Kindleで出版したり、作成したショート動画をTikTokに投稿して広告収入を狙うなど、将来的に自動で収入が入り続ける仕組みを構築します。\n\n` +
    `---` +
    `\n\n### 4. 安全に稼ぐためのルールと確定申告のポイント\n\n` +
    `副業を安全に楽しむために、必ず守るべき最重要事項です。\n\n` +
    `* **「だれでも1クリックで100万円」といった怪しい広告は100%無視する**\n` +
    `   本当に稼げるAI副業は、ツールを自分の手で操作してクライアントや読者の悩みを解決する "実務" です。高額なスクール勧誘や詐欺商材には一切耳を貸さず、まずは無料ツールを自分の手で動かすことから安全にスタートしましょう。\n` +
    `* **副業収入が年間20万円を超えたら確定申告を行う**\n` +
    `   副業での所得（年間収入から経費を引いた額）が年間20万円を超えた場合は、翌年に確定申告が必要になります。日々の帳簿づけや経費管理を徹底しておきましょう。\n\n` +
    `---` +
    `\n\n### コウジのアドバイス\n\n` +
    `新しいトレンドが登場したときは、ただ「面白いな」と眺めるだけでなく、「これをテーマに発信したら喜ぶ人がいるかな？」「どうやったら収入に繋がるかな？」と考えてみる癖をつけるのが、副業脳を育てる第一歩です。\n\n` +
    `千里の道も一歩から。まずは小さな情報発信やライティングから、自宅で安全にチャレンジしてみませんか？あなたの第一歩を応援しています！`;

  // バッファ制限を回避するために、画像指示も短く分割します
  const dynamicImagePrompt = "A stunning and high-tech 3D render illustration representing the workspace theme of " + 
    seedNameClean + ", cozy soft lighting, modern tablet display with colorful UI, highly detailed";

  return {
    title: title,
    slug: safeSlug + '-' + Math.floor(Math.random() * 1000),
    summary: summary,
    content: markdownContent,
    category: '副業ノウハウ',
    tags: [seedNameClean, 'AI副業', '在宅ワーク', '初心者向け', 'コウジの解説'],
    imagePrompt: dynamicImagePrompt
  };
}