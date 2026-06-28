// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

// 万が一、AIの連携（マルチエージェント）が両方ともエラーになった場合の、高品質な予備キーワード
const FALLBACK_AI_TOPICS = [
  'ChatGPTと画像生成AIを使ったKindle電子書籍・絵本の出版ビジネス',
  '顔出し不要！AI音声とCapCutを使ったTikTokショート動画の自動収益化',
  'CanvaとMidjourneyを使ったSNS運用代行・バナーデザイン副業',
  'Notionのオリジナルテンプレート販売ビジネスの始め方と収益化'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const seed = Math.floor(Math.random() * 9999999);

    // ==========================================
    // 【ステップ1】AIエージェントA（ブレイン）：最新のAI副業テーマを自律発案する
    // ==========================================
    let keyword = '';
    try {
      const brainPrompt = `あなたは最先端のデジタルマーケターです。
現在、日本国内で『ChatGPT, Midjourney, Vrew, HeyGen, Suno, CapCut』などの最新AIツールやSNS自動化を組み合わせて、一般の初心者や主婦、サラリーマンが安全かつ高確率で「月5万〜20万円」を稼げる、非常に具体的で斬新な「AI副業・在宅ワークのテーマ」を1つだけ考案してください。
「ブログを書く」「動画を編集する」といった抽象的で平凡なテーマは厳禁です。

出力は、余計な説明や前置き（「はい、考えました」等）は一切含めず、タイトルとなるテーマの文字列のみを100%日本語で出力してください。

出力例：
ChatGPTと画像生成AIを活用した、Amazon Kindle子供向け英語絵本の自動出版ビジネス`;

      const brainResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: brainPrompt }
          ],
          model: 'openai',
          seed: seed
        })
      });

      if (brainResponse.ok) {
        keyword = (await brainResponse.text()).trim();
        // 万が一マークダウン（#など）が入った場合のためにクレンジング
        keyword = keyword.replace(/[#*`"']/g, '').trim();
      } else {
        throw new Error('Agent B (Brain) Failed to respond.');
      }
    } catch (e) {
      console.warn('エージェントBのテーマ発案が失敗したため、予備リストを使用します。', e);
      keyword = FALLBACK_AI_TOPICS[Math.floor(Math.random() * FALLBACK_AI_TOPICS.length)];
    }

    // ==========================================
    // 【ステップ2】AIエージェントC（ライター「コウジ」）：テーマを元に傑作コラムを執筆する
    // ==========================================
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (minimum 600 words)","category":"string","tags":["string"],"imagePrompt":"string"}. ' +
      'STRICT RULES FOR KOJI: You are Koji, a friendly and expert personal finance and AI automation side-hustle advisor in Japan. ' +
      `Your topic to write about today is: "${keyword}". ` +
      'Your article MUST follow this structure: ' +
      '1) Introduction & Fact/Case Study: Warmly introduce the specific AI tool/concept. You MUST explain a realistic success case study (e.g. how a complete beginner earned money using this specific tech stack) in fluent Japanese. Give real tool names! ' +
      '2) Required Tools (The Tech Stack): List the exact, real-world AI and digital tools needed (e.g., ChatGPT, Midjourney, CapCut, Suno, Notion) and what they do. ' +
      '3) Actionable Step-by-Step Guide: Write an extremely practical, easy-to-follow, step-by-step Japanese guide on how to actually start, execute, and monetize this specific side gig. ' +
      '4) Safety, Tax & Compliance: Remind readers in Japanese about tax filing (kakutei shinkoku) when side income exceeds 200,000 yen, and warn them to avoid high-priced scams. ' +
      '5) Koji\'s Take: Conclude with Koji\'s encouraging, friendly closing advice in Japanese. ' +
      'STRICT IMAGE PROMPT RULE: You MUST write a custom, highly specific imagePrompt in English representing the theme of the article. For example, if it is about childrens book publishing, describe colorful illustration book covers on a tablet. If it is about audio synthesized podcasts, describe a premium microphone with neon soundwaves. DO NOT generate simple office desks. ' +
      'STRICT LANGUAGE RULE: You MUST write the entire JSON response (title, summary, content, category, tags) strictly in 100% fluent, natural, professional Japanese (です・ます調). Output raw JSON only. Seed: ' + seed;

    const userPrompt = `Generate a masterpiece, highly practical case-study article based on the research theme: "${keyword}".`;
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
          model: 'openai', // 超高速モデル
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
        throw new Error('Agent C (Koji) failed to respond.');
      }
    } catch (apiError) {
      console.warn('エージェントCの執筆が失敗したため、安全用の日本語フォールバックを起動します:', apiError);
      blogData = generateFallbackPayload(keyword);
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
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(blogData.imagePrompt + ', modern graphic design, vibrant masterpiece, high res') + '?width=1024&height=576&nologo=true&seed=' + seed;
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

    return NextResponse.json({ success: true, data: { source: 'multi_agent_collaboration', researchedTopic: keyword, title: blogData.title, slug: blogData.slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（万が一の時用）
function generateFallbackPayload(keyword: string) {
  const safeSlug = encodeURIComponent(keyword.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')) || 'side-hustle';
  
  const title = `【最先端AI副業】未経験から月10万稼ぐ！「${keyword}」の実践手順と成功事例`;
  const summary = `最新のAI技術である「${keyword}」を活用し、初心者でも安全に自宅で収入を得るための具体的な手順と、実際に結果を出した事例を詳しく解説します。`;

  const markdownContent = `### 1. はじめに：AIを活用した「${keyword}」とは？

こんにちは！副業アドバイザーのコウジです。今回は、今まさにビジネス界隈で大きな話題を集めている、最新のAIツールを活用した**「${keyword}」**について解説します。

近年、AI技術の進化によって、これまで専門スキルが必要だった「動画編集」「デザイン作成」「書籍出版」といったお仕事を、個人が数時間でハイクオリティにこなせる時代が到来しました。実際に、副業未経験からスタートした多くのサラリーマンや主婦の方が、AIを相棒にすることで**「初月から数万円、3ヶ月以内に月10万円以上」の安定した成果**を叩き出しています。

今回は、実際に初心者チームが成功した具体的なケーススタディを元に、使用するツールや実践的なアプローチを網羅してお届けします。

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
   副業で得た所得（年間収入からサーバー代やツール代などの経費を引いた額）が年間20万円を超えた場合は、翌年に確定申告が必要になります。日々の帳簿づけや経費管理を徹底しておきましょう。

---

### コウジのアドバイス

AIが普及することで「個人の仕事が奪われる」と不安視されることもありますが、現実に起きているのは**「AIを使いこなす個人が、AIを使わないプロを圧倒する」**という下克上のような現象です。

最初は難しく感じるかもしれませんが、スマホ感覚でAIに指示を出せるようになれば、まるで自分専用のアシスタントが24時間体制で働いてくれているような強みを手に入れられます。
千里の道も一歩から。まずは無料のアカウント作成から、自宅で安全に新しい収入源作りにチャレンジしてみませんか？あなたの第一歩を応援しています！`;

  // フォールバック用の動的画像指示
  const dynamicImagePrompt = `A stunning and high-tech 3D render illustration representing the workspace theme of ${keyword}, cozy soft lighting, modern tablet display with colorful UI, highly detailed`;

  return {
    title: title,
    slug: safeSlug + '-' + Math.floor(Math.random() * 1000),
    summary: summary,
    content: markdownContent,
    category: '副業ノウハウ',
    tags: [keyword.replace(/\s+/g, '').substring(0, 10), 'AI副業', '在宅ワーク', '初心者向け', 'コウジの解説'],
    imagePrompt: dynamicImagePrompt
  };
}
'@

# 2. 安全に上書き保存を実行します
$RouteCode | Out-File -LiteralPath "app/api/cron/generate/route.ts" -Encoding utf8