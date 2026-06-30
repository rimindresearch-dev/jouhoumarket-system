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

    const targetTitle = queueData.title; // 👈 これがひな型テーマ（例：バナー作成代行）になります

    // 2. 4段階構成テンプレートのプロンプト（AI自身にタイトルとフックを自律的に考えさせます）
    const sysPrompt = 'Write a SEO blog format. Your output MUST NOT be JSON. Output raw plain text strictly with the following delimiters. Do not wrap in markdown code blocks. ' +
      'STRICT JOURNALISTIC RULES FOR KOJI: You are Koji, an expert Japanese side-hustle advisor. ' +
      'Your article content MUST strictly follow this exact 4-step structure in fluent Japanese (です・ます調):\n\n' +
      '[TITLE]\n' +
      `Generate an extremely catchy, high-converting Japanese article title (like "スマホ1台でできる！ChatGPTを活用してバナー作成代行で毎月3万円を得る方法") based on the raw draft theme: "${targetTitle}". Do NOT use "${targetTitle}" literally; expand it into a masterpiece title.\n` +
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
      'Write the complete article body text (minimum 1000 words) using these exact Markdown headings. Write completely unique and valuable content for each section:\n' +
      '### 1. タイトル＆冒頭フック\n' +
      '（あなたが上で考えた「新しい記事タイトル」に基づき、具体的な数字や事実で引きつけ、誰のための記事かを明示するフック文章を3行以内で執筆してください）\n' +
      '### 2. 問題提起・共感ゾーン\n' +
      '（読者が抱えている悩みをそのまま言語化。「わかってる!」と思わせる共感の文章）\n' +
      '### 3. 結論を先出し\n' +
      '（この記事でわかることを3〜5個の箇条書きで明示し、読む理由を渡す文章）\n' +
      '### 4. 本文：ステップ or 比較 or 体験談\n' +
      '（副業・新しいやり方の「ステップ形式」または「やってみた形式」で、具体的な手順、画像・スクショの説明、使用するリアルなツール名：ChatGPT, CapCut, Suno, Midjourney, Vrew などを詳しく解説する文章）';

    const userPrompt = `Please brainstorm a great article title and write the complete masterpiece article based on the draft theme: "${targetTitle}" using the 4-step template.`;

    const aiText = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
        model: 'openai',
        seed: seed
      })
    });

    const rawText = await aiText.text();
    
    // 自作の安全抽出関数（extractPart）でバグなく正確に切り出し
    const titleStr = extractPart(rawText, 'TITLE') || targetTitle; // AIが考えたタイトルを適用（なければひな型をフォールバック）
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

    // 3. 画像生成とR2アップロード
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

    // 4. カテゴリの取得または新規作成
    let catId: string;
    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).limit(1).maybeSingle();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin.from('categories').insert({ name: categoryName, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCategory.id;
    }

    // 5. Supabaseへ記事データを保存（AIが考えた綺麗なタイトル titleStr で保存します）
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: titleStr,
      slug: slugStr,
      summary: summaryStr || (titleStr + 'のロードマップを分かりやすく解説します。').substring(0, 240),
      content: contentStr,
      cover_image_url: coverUrl,
      category_id: catId,
      status: 'published',
      published_at: new Date().toISOString()
    }).select('id').single();

    if (postError) throw postError;

    // 6. タグの紐付け処理
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

    // 7. 処理が終わったタイトルを予約リストから自動削除
    await supabaseAdmin.from('title_queue').delete().eq('id', queueData.id);

    return NextResponse.json({ success: true, title: titleStr });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（万が一の時用）
function generateFallbackPayload(seedCategory: string, seedNameClean: string) {
  const safeSlug = 'fallback-' + Math.floor(Math.random() * 10000);
  
  const title = `【AI副業】未経験から月10万稼ぐ！「${seedNameClean}」の実践手順と成功事例`;
  const summary = `最新のAI技術である「${seedCategory}」を活用し、初心者でも安全に自宅で収入を得るための具体的な手順と、実際に結果を出した事例を詳しく解説します。`;

  const markdownContent = `### 1. はじめに：AIを活用した「${seedNameClean}」とは？

こんにちは！副業アドバイザーのコウジです。最近、インターネットやSNS上で**「${seedCategory}」**というキーワードが大きな注目を集めています。
実は、こうした急上昇する最新トレンドや話題のテーマには、私たちが在宅ワークや副業で新しい収入源を作るための「ヒント」が隠されています。\n\n
近年、AI技術の進化によって、これまで専門スキルが必要だったお仕事が、個人が数時間でハイクオリティにこなせる時代が到来しました。実際に、
副業未経験からスタートした多くのサラリーマンや主婦の方が、AIを相棒にすることで「初月から数万円、3ヶ月以内に月10万円以上」の安定した成果を叩き出しています。\n\n
---
\n\n### 2. 稼ぐために必要な「ツールの組み合わせ（Tech Stack）」\n\n
この副業を成立させるために使用する、具体的かつすべて無料で始められるAI・デザインツールは以下の通りです。\n\n
1. **文章・企画案の作成：ChatGPT (OpenAI) / Claude**\n
   * お仕事の台本テキストや、全体の構成案、キャッチコピーの自動作成など「言語化」のすべてを担当します。\n
2. **デザイン・イラスト生成：Canva / Midjourney / DALL-E 3**\n
   * 書籍の表紙デザイン、動画用のイラスト素材、おしゃれなバナー画像を数秒で最高品質に生成します。\n
3. **動画・音声の編集：CapCut / Vrew / ElevenLabs**\n
   * 綺麗なテロップ（字幕）の自動挿入や、AIによる超リアルな日本語ナレーション（吹き替え）の作成を自動で行います。\n\n
---
\n\n### 3. 未経験から収入を得るための「実践ステップ（3ステップ）」\n\n
自宅から安全に最初の一歩を踏み出すための具体的な流れです。\n\n
1. **AIツールを実際に触って「サンプル」を作ってみる**\n
   まずは無料のAIツール（ChatGPTなど）を触り、ご自身で動画のサンプルを3〜5本作成してみます。AIの指示に慣れることが一番の近道です。\n
2. **クラウドソーシングでの「お仕事獲得」**\n   「クラウドワークス」や「ココナラ」に登録し、作成したサンプルをアピールして、Webライター、ロゴ作成、動画編集などの案件に応募します。AIを使えば数分の一の時間で納品できるため、効率よく高い利益率を確保できます。\n
3. **自社メディアでの「資産化」**\n   依頼を受けて稼ぐだけでなく、作成した電子書籍をAmazon Kindleで出版したり、作成したショート動画をTikTokに投稿して広告収入を狙うなど、将来的に自動で収入が入り続ける仕組みを構築します。\n\n
---
\n\n### 4. 安全に稼ぐためのルールと確定申告のポイント\n\n
副業を安全に楽しむために、必ず守るべき最重要事項です。\n\n
* **「だれでも1クリックで100万円」といった怪しい広告は100%無視する**\n
   本当に稼げるAI副業は、ツールを自分の手で操作してクライアントや読者の悩みを解決する "実務" です。高額なスクール勧誘や詐欺商材には一切耳を貸さず、まずは無料ツールを自分の手で動かすことから安全にスタートしましょう。\n
* **副業収入が年間20万円を超えたら確定申告を行う**\n
   副業での所得（年間収入から経費を引いた額）が年間20万円を超えた場合は、翌年に確定申告が必要になります。日々の帳簿づけや経費管理を徹底しておきましょう。\n\n
---
\n\n### コウジのアドバイス\n\n
新しいトレンドが登場したときは、ただ「面白いな」と眺めるだけでなく、「これをテーマに発信したら喜ぶ人がいるかな？」「どうやったら収入に繋がるかな？」と考えてみる癖をつけるのが、副業脳を育てる第一歩です。\n\n
千里の道も一歩から。まずは小さな情報発信やライティングから、自宅で安全にチャレンジしてみませんか？あなたの第一歩を応援しています！`;

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
