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

    // 2. 超具体的・事実ベースの記事執筆指示（JSONエラーを永久追放するデリミタ方式）
    const sysPrompt = `あなたは日本の優秀な副業・在宅ワークアドバイザー「コウジ」です。
Bさん（リサーチャー）が発案したテーマ「\${seedCategory}」について、初心者向けの実践手順を1から丁寧に解説する傑作コラムを執筆してください。
出力はJSON形式ではなく、必ず以下の区切り文字（デリミタ）を入れて、プレーンテキストのみで出力してください（マークダウンのコードブロック \`\`\` 等で囲わないでください）。

[TITLE]
ここにタイトル（最大40文字。「\${seedNameClean}」を必ず盛り込み、初心者を引きつける魅力的な日本語タイトル）
[SLUG]
ここにURL用の英語スラッグ（英数字とハイフンのみ、例: koji-sidehustle-123）
[SUMMARY]
ここに100文字程度の簡潔な要約
[CATEGORY]
登録するカテゴリ名（例: 副業ノウハウ、在宅ワーク、ネットビジネス）
[TAGS]
タグ（半角カンマ区切り、例: 在宅ワーク,初心者,ブログ）
[IMAGE_PROMPT]
カバー画像生成用の「英語のプロンプト」（テーマ「\${seedNameClean}」を元に、明るく現代的なコワーキングスペースやデスクワーク、またはテーマに関連する美麗な3Dイラストの英語指示。例: A cozy and bright 3D render illustration representing the theme of \${seedNameClean}...）
[CONTENT]
ここから詳しい記事本文を書いてください。
導入部分では、読者のために必ず「\${seedNameClean}」が一体何であるのかを詳しく丁寧に解説・紹介してください。その後、副業や在宅ワークに論理的かつ自然に結びつける構成にしてください。
4章（安全に稼ぐためのルール・確定申告）や5章（コウジのアドバイス）も、定型文を一切使わず、このテーマに特化した独自の意見や言葉だけで、毎回1から完全に新しく執筆してください。`;

    const userPrompt = `Invent an amazing, highly practical AI side-hustle concept based on "${seedCategory}", and write the full Japanese guide using the plain-text delimiter format.`;
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
          seed: seed
        })
      });

      if (aiText.ok) {
        const rawText = await aiText.text();
        
        // 正規表現を使って各項目を安全に切り分ける（JSONパースエラーが100%起きません）
        const titleMatch = rawText.match(/\[TITLE\]\s*([\s\S]*?)\s*\[SLUG\]/i);
        const slugMatch = rawText.match(/\[SLUG\]\s*([\s\S]*?)\s*\[SUMMARY\]/i);
        const summaryMatch = rawText.match(/\[SUMMARY\]\s*([\s\S]*?)\s*\[CATEGORY\]/i);
        const categoryMatch = rawText.match(/\[CATEGORY\]\s*([\s\S]*?)\s*\[TAGS\]/i);
        const tagsMatch = rawText.match(/\[TAGS\]\s*([\s\S]*?)\s*\[IMAGE_PROMPT\]/i);
        const imagePromptMatch = rawText.match(/\[IMAGE_PROMPT\]\s*([\s\S]*?)\s*\[CONTENT\]/i);
        const contentMatch = rawText.match(/\[CONTENT\]\s*([\s\S]*)/i);
        
        if (titleMatch && slugMatch && summaryMatch && contentMatch) {
          const category = categoryMatch ? categoryMatch[1].trim() : '副業ノウハウ';
          const parsedTags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [seedNameClean];
          const imagePromptStr = imagePromptMatch ? imagePromptMatch[1].trim() : `A stunning 3D render illustration representing the theme of ${seedNameClean}`;

          blogData = {
            title: titleMatch[1].trim(),
            slug: slugMatch[1].trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
            summary: summaryMatch[1].trim(),
            content: contentMatch[1].trim(),
            category: category,
            tags: parsedTags,
            imagePrompt: imagePromptStr
          };
        } else {
          throw new Error('デリミタパースに失敗しました。フォールバックを作動させます。');
        }
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

    // スラッグが既存のものと重複する場合はランダムな末尾を付与
    const { data: dupSlug } = await supabaseAdmin.from('posts').select('id').eq('slug', blogData.slug).limit(1).maybeSingle();
    if (dupSlug) {
      blogData.slug = blogData.slug + '-' + Math.floor(Math.random() * 1000);
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
    const categoryName = blogData.category || '副業ノウハウ';
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
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: blogData.title, 
      slug: blogData.slug, 
      summary: blogData.summary, 
      content: blogData.content, 
      cover_image_url: coverUrl, 
      category_id: catId, 
      status: 'published', 
      published_at: new Date().toISOString()
    }).select('id').single();
    
    if (postError) throw postError;

    // 7. タグの紐付け処理
    if (Array.isArray(blogData.tags)) {
      await Promise.all(blogData.tags.map(async (t: string) => {
        if (!t) return;
        const tSlug = encodeURIComponent(t.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')) || 'tag-' + Math.floor(Math.random() * 1000);
        let tId: string;
        const { data: extTag } = await supabaseAdmin.from('tags').select('id').eq('slug', tSlug).limit(1).maybeSingle();
        if (extTag) {
          tId = extTag.id;
        } else {
          const { data: nTag, error: tErr } = await supabaseAdmin.from('tags').insert({ name: t, slug: tSlug }).select('id').single();
          if (tErr) throw tErr;
          tId = nTag.id;
        }
        await supabaseAdmin.from('post_tags').insert({ post_id: newPost.id, tag_id: tId });
      }));
    }

    return NextResponse.json({ success: true, data: { source: 'multi_agent_delimiter_collaboration', researchedTopic: seedCategory, title: blogData.title, slug: blogData.slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（万が一の時用）
function generateFallbackPayload(seedCategory: string, seedNameClean: string) {
  const safeSlug = encodeURIComponent(seedCategory.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')) || 'side-hustle';
  
  const title = `【AI副業】未経験から月10万稼ぐ！「${seedNameClean}」の実践手順と成功事例`;
  const summary = `最新のAI技術である「${seedCategory}」を活用し、初心者でも安全に自宅で収入を得るための具体的な手順と、実際に結果を出した事例を詳しく解説します。`;

  const markdownContent = `### 1. はじめに：AIを活用した「${seedNameClean}」とは？

こんにちは！副業アドバイザーのコウジです。今回は、今まさにビジネス界隈で大きな話題を集めている、最新のAIツールを活用した**「${seedCategory}」**について解説します。

近年、AI技術の進化によって、これまで専門スキルが必要だった「動画編集」「デザイン作成」「書籍出版」といったお仕事を、個人が数時間でハイクオリティにこなせる時代が到来しました。実際に、副業未経験からスタートした多くのサラリーマンや主婦の方が、AIを相棒にすることで**「初月から数万円、3ヶ月以内に月10万円以上」の安定した成果**を叩き出しています。

---

### 2. 稼ぐために必要な「ツールの組み合わせ（Tech Stack）」

この副業を成立させるために使用する、具体的かつすべて無料で始められるAI・デザインツールは以下の通りです。

1. **文章・企画案の作成：ChatGPT (OpenAI) / Claude**
   * お仕事の台本テキストや、全体の構成案、キャッチコピーの自動作成など「言語化」のすべてを担当します。
2. **デザイン・イラスト生成：Canva / Midjourney / DALL-E 3**
   * 書籍の表紙デザイン、動画用のイラスト素材、おしゃれなバナー画像を数秒で最高品質に生成します。
3. **動画・音声の編集：CapCut / Vrew / ElevenLabs**
   * 綺麗なテロップ（字幕）の自動挿入や、AIによる超リアルな日本語ナレーション（吹き替え）の作成を、自動でほぼワンクリックで行います。

---

### 3. 未経験から収入を得るための「実践ステップ（3ステップ）」

自宅から安全に最初の一歩を踏み出すための具体的な流れです。

1. **AIツールを実際に触って「サンプル」を作ってみる**
   まずは無料のAIツール（ChatGPTなど）を触り、ご自身で短いコラム記事や動画のサンプルを3〜5本作成してみます。AIの指示（プロンプト）に慣れることが一番の近道です。
2. **クラウドソーシングでの「お仕事獲得」**
   「クラウドワークス」や「ココナラ」に登録し、作成したサンプルをアピールして、Webライター、ロゴ作成、動画編集などの案件に応募します。AIを使えば数分の一の時間で納品できるため、効率よく高い利益率を確保できます。
3. **自社メディアでの「資産化」**
   依頼を受けて稼ぐだけでなく、作成した電子書籍をAmazon Kindleで出版したり、作成したショート動画をTikTokに投稿して広告収入を狙うなど、将来的に自動で収入が入り続ける仕組みを構築します。

---

### 4. 安全に稼ぐためのルールと確定申告のポイント

副業を安全に楽しむために、必ず守るべき最重要事項です。

* **「だれでも1クリックで100万円」といった怪しい広告は100%無視する**
   本当に稼げるAI副業は、ツールを自分の手で操作してクライアントや読者の悩みを解決する「実務」です。高額なスクール勧誘や詐欺商材には一切耳を貸さず、まずは無料ツールを自分の手で動かすことから安全にスタートしましょう。
* **副業収入が年間20万円を超えたら確定申告を行う**
   副業で得た所得（年間収入から経費を引いた額）が年間20万円を超えた場合は、翌年に確定申告が必要になります。日々の帳簿づけや経費管理を徹底しておきましょう。

---

### コウジのアドバイス

新しいトレンドが登場したときは、ただ「面白いな」と眺めるだけでなく、「これをテーマに発信したら喜ぶ人がいるかな？」「どうやったら収入に繋がるかな？」と考えてみる癖をつけるのが、副業脳を育てる第一歩です。

千里の道も一歩から。まずは小さな情報発信やライティングから、自宅で安全にチャレンジしてみませんか？あなたの第一歩を応援しています！`;

  // フォールバック用の動的画像指示
  const dynamicImagePrompt = `A stunning and high-tech 3D render illustration representing the workspace theme of ${seedNameClean}, cozy soft lighting, modern tablet display with colorful UI, highly detailed`;

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
