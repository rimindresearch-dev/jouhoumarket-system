// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

// 【絶対に安全】かつ「副業・在宅ワーク・スキルアップ・マネー情報」に特化した厳選キーワード
const SAFE_SIDE_HUSTLE_KEYWORDS = [
  '在宅ワーク 初心者おすすめ',
  'AI副業 始め方',
  'スマホでできる安全な副業',
  'サラリーマンの副業 確定申告',
  '動画編集 在宅ワークの現実',
  'ブログ収益化のロードマップ',
  'メルカリ物販で月5万稼ぐ手順',
  'SNS運用代行の始め方',
  'ChatGPTを使った副業アイデア',
  '安全なネットビジネスの見分け方',
  'スキルなしから始めるWEBライター',
  'Canvaデザイン副業のやり方',
  'オンラインアシスタント 始め方',
  '音声データ入力 バイトのコツ',
  '主婦におすすめのプチ副業',
  'ポイ活で安全に月3万円',
  'プログラミング副業 独学マップ',
  '週末起業のアイデア出し',
  'ココナラでスキルを売る方法',
  'タイピングが早い人向けの副業',
  'Excelスキルを活かせる在宅ワーク',
  '初心者が騙されない副業スクール',
  'ブログ記事の書き方 構成テンプレート',
  '会社にバレない副業のやり方',
  '副業用の銀行口座・クレジットカード選定',
  'Notionを活用したタスク管理・副業効率化',
  '画像生成AIビジネスの可能性',
  'オンライン日本語教師の始め方',
  '手芸・ハンドメイド作品のネット販売',
  'ストックフォト 写真販売副業',
  'kindle出版 印税生活のリアル',
  '電子書籍の作り方 初心者向け',
  'ライティングの構成案 作成手順',
  '成果が出るアフィリエイト広告の貼り方',
  '副業での開業届 提出タイミング',
  'クラウドワークスで初案件を受注するコツ',
  'ランサーズのプロフィール文の書き方',
  '副業で役立つ時間管理術',
  'ポッドキャスト音声配信の収益化',
  'WEBデザイン ゼロからの勉強法',
  'ブログのSEO対策 基本の5ステップ',
  '主婦が在宅で稼ぐためのタイムスケジュール',
  'スマホ動画編集アプリ CapCut活用法',
  '安全に稼げるアンケートモニターサイト',
  'スキマ時間を資産に変える方法',
  '副業詐欺を即座に見破るチェックリスト',
  '初心者のためのWebマーケティング入門',
  'フリマアプリでの梱包・発送の自動化テクニック'
];

// センシティブなキーワードを弾くためのNG単語リスト
const SENSITIVE_NG_WORDS = [
  '病', 'がん', '癌', '死', '訃', '亡', '逝', '逮捕', '容疑', '事件', '事故', '殺人', '強盗', '詐欺', 
  '地震', '津波', '台風', '被災', '震災', '戦争', '軍', 'ミサイル', 'ウクライナ', 'パレスチナ', '衝突',
  '政治', '選挙', 'スキャンダル', '不倫', '離婚', '引退', '謝罪', '批判', '抗議', 'コロナ', 'ウイルス', 
  'ハンセン', '障害', '差別', '銃', '爆発', '火災', '被害', '裁判'
];

function isSensitive(keyword: string): boolean {
  return SENSITIVE_NG_WORDS.some(ngWord => keyword.includes(ngWord));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let keyword = SAFE_SIDE_HUSTLE_KEYWORDS[Math.floor(Math.random() * SAFE_SIDE_HUSTLE_KEYWORDS.length)];
    let source = 'fallback_list';

    // 1. Googleトレンド（日本版）から急上昇キーワードを取得
    try {
      const rss = await fetch('https://trends.google.com/trending/rss?geo=JP', { next: { revalidate: 0 } });
      if (rss.ok) {
        const xmlText = await rss.text();
        const matches = [...xmlText.matchAll(/<title>([^<]+)<\/title>/g)];
        const rawTrends = matches.slice(1).map((match) => match[1].trim());

        if (rawTrends.length > 0) {
          const { data: recentPosts } = await supabaseAdmin
            .from('posts')
            .select('slug')
            .order('published_at', { ascending: false })
            .limit(50);
          
          const existingSlugs = new Set((recentPosts || []).map((p) => p.slug));

          const safeTrends = rawTrends.filter((trend) => {
            if (isSensitive(trend)) return false;
            const tempSlug = encodeURIComponent(trend.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-'));
            return !existingSlugs.has(tempSlug);
          });

          if (safeTrends.length > 0) {
            keyword = safeTrends[Math.floor(Math.random() * safeTrends.length)];
            source = 'google_trends_jp';
          }
        }
      }
    } catch (e) {
      console.warn('Google Trends JP RSSの取得に失敗したため、副業特化リストを使用します', e); 
    }

    const seed = Math.floor(Math.random() * 9999999);

    // 2. Geminiの代わりに、10秒制限をクリアできる爆速の openai モデルでマスターピースJSONを要求
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (minimum 600 words)","category":"Japanese Category (e.g., 副業ノウハウ, 在宅ワーク, ネットビジネス)","tags":["string"],"imagePrompt":"string"}. ' +
      'STRICT JOURNALISTIC RULES FOR KOJI: You are Koji, a friendly and expert personal finance and side-hustle advisor in Japan. Your article MUST follow this structure: ' +
      '1) Introduction: Warmly explain WHAT the subject/keyword is in detail in fluent Japanese. ' +
      '2) The Connection to Side Hustle: Intelligently and logically explain how readers can leverage this trend or topic to earn income in Japan (e.g., blogging, remote tech skills, web writing, reselling, or teaching beginners about this topic, or what we can learn about marketing from this trend). ' +
      '3) Step-by-Step Guide: Write an extremely practical, easy-to-follow, step-by-step Japanese guide on how a complete beginner can start this related side gig. ' +
      '4) Safety & Compliance: Remind readers in Japanese about tax filing (kakutei shinkoku) when side income exceeds 200,000 yen, and warn them to avoid high-priced get-rich-quick scams. ' +
      '5) Koji\'s Take: Conclude with Koji\'s distinctive, encouraging, friendly closing advice in Japanese. ' +
      'STRICT LANGUAGE RULE: You MUST write the entire JSON response (title, summary, content, category, tags) strictly in 100% fluent, natural, professional Japanese (です・ます調). Output raw JSON only. Seed: ' + seed;

    const userPrompt = 'Generate a unique, masterpiece article about: "' + keyword + '".';
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
          model: 'openai', // 👈 タイムアウトを防ぐ超高速openaiモデルを設定
          jsonMode: true
        })
      });

      if (aiText.ok) {
        // Bobと同じ、余分な記号を切り取るクレンジングパーサーを適用
        const rawJsonText = await aiText.text();
        const startIndex = rawJsonText.indexOf('{');
        const endIndex = rawJsonText.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error('No valid JSON found');
        const cleanJson = rawJsonText.substring(startIndex, endIndex + 1);
        blogData = JSON.parse(cleanJson);
      } else {
        console.warn('Text API returned error status. Activating programmatic fallback payload.');
        blogData = generateFallbackPayload(keyword);
      }
    } catch (apiError) {
      console.warn('Text API fetch failed. Activating programmatic fallback payload.', apiError);
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
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(blogData.imagePrompt + ', anime style, vibrant masterpiece, high res') + '?width=1024&height=576&nologo=true&seed=' + seed;
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

    // 7. タグの紐付け処理 (日本語タグ対応)
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

    return NextResponse.json({ success: true, data: { source, keyword, title: blogData.title, slug: blogData.slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 日本語の自動フォールバックコラム作成関数（AIエラー時にも毎回確実に「異なる画像と記事」を書き出す安全設計）
function generateFallbackPayload(keyword: string) {
  const safeSlug = encodeURIComponent(keyword.toLowerCase().replace(/[\s\t\r\n\\\/'"]/g, '-').replace(/(^-|-$)/g, '')) || 'side-hustle';
  
  const titles = [
    keyword + 'から学ぶ！初心者でも自宅で安全に稼ぐための副業・在宅ワーク完全ガイド',
    '【在宅副業】今話題の「' + keyword + '」をテーマに情報発信ブログで稼ぐロードマップ',
    '副業初心者必見：' + keyword + 'の需要から紐解く、安全なオンライン仕事術と確定申告のコツ'
  ];

  const summaries = [
    '話題のキーワード「' + keyword + '」を切り口に、初心者でも自宅で安全に始められる具体的な副業アイデアと実践ステップを分かりやすく解説します。',
    '最新トレンドの「' + keyword + '」に関する情報を発信して稼ぐ、安全なブログ運営やライティング副業のロードマップを丁寧にお届けします。'
  ];

  const hash = keyword.length;
  const selectedTitle = titles[hash % titles.length];
  const selectedSummary = summaries[hash % summaries.length];

  // フォールバックでも画像が同じになるのを防ぐため、画像指示（プロンプト）に自動でキーワードを埋め込み動的化
  const dynamicImagePrompt = `A cozy and bright 3D render illustration of a home desk with a laptop, representing the modern workspace theme of ${keyword}, warm cozy lighting, highly detailed`;

  const markdownContent = `### はじめに：今話題の「${keyword}」について解説

こんにちは！副業アドバイザーのコウジです。最近、インターネットやSNS上で**「${keyword}」**というキーワードが大きな注目を集めています。実は、こうした急上昇する最新トレンドや話題のテーマには、私たちが在宅ワークや副業で新しい収入源を作るための「ヒント」がたくさん隠されています。

今回は、この最新トレンドをテーマに、初心者でも安全にオンラインで稼ぐための具体的なアイデアと実践方法をわかりやすく解説します。

---

### 「${keyword}」を副業・在宅ワークに活かす具体的なアプローチ

トレンド性の高いテーマは、特に以下のようなネット副業と非常に相性が良いのが特徴です。

1. **特化ブログ・アフィリエイトでの情報発信**
   「${keyword}」について調べる人が増えている今、関連する解説記事や最新情報をまとめたブログを書くことで、短期間でアクセスを集めることができます。広告収入（Googleアドセンスやアフィリエイト）を狙う絶好のチャンスです。
2. **WEBライティング案件の獲得**
   クラウドソーシングサイト（クラウドワークスやランサーズなど）では、今話題のテーマに関する記事執筆（コラムライティング）の案件が多数募集されます。トレンドに詳しくなることで、高単価なライター案件を受注しやすくなります。

---

### トレンドブログ・Webライターを安全に始めるステップ

未経験から自宅で安全にスタートするための基本的な流れは以下の通りです。

1. **まずは徹底したリサーチから始める**
   「${keyword}」に関連する最新ニュースや、人々が「何に困っているか（知りたいことは何か）」をリサーチします。
2. **無料のブログやクラウドソーシングに登録する**
   WordPressでのブログ開設がベストですが、まずはクラウドワークス等のプラットフォームに登録してライティングの感覚を掴むのもおすすめです。
3. **読者の悩みを解決する文章を書く**
   ただの日記ではなく、「この記事を読めば疑問が解決する」という丁寧な構成を意識して執筆しましょう。

---

### 安全に稼ぐためのルールと確定申告のポイント

副業を楽しく、そして安全に続けるためにはいくつかの重要な注意点があります。

* **ネット上の甘い言葉（詐欺案件）に注意する**
   「誰でも1日5分で10万円」「簡単作業で高額報酬」といった極端な募集は、高額な情報商材の売りつけや詐欺の可能性が非常に高いです。必ず信頼できるプラットフォームを利用し、安全第一で作業しましょう。
* **副業収入が年間20万円を超えたら確定申告を**
   副業での所得（収入から経費を引いた額）が年間20万円を超えた場合は、翌年に確定申告（所得税の申告や住民税 of 住民税の申告）が必要です。日々の経費や収入はしっかり帳簿をつけて管理しておきましょう。

---

### コウジのアドバイス

新しいトレンドが登場したときは、ただ「面白いな」と眺めるだけでなく、「これをテーマに発信したら喜ぶ人がいるかな？」「どうやったら収入に繋がるかな？」と考えてみる癖をつけるのが、副業脳を育てる第一歩です。

千里の道も一歩から。まずは小さな情報発信やライティングから、自宅で安全にチャレンジしてみませんか？あなたの第一歩を応援しています！`;

  return {
    title: selectedTitle,
    slug: safeSlug + '-' + Math.floor(Math.random() * 1000),
    summary: selectedSummary,
    content: markdownContent,
    category: '副業ノウハウ',
    tags: [keyword.replace(/\s+/g, ''), '在宅ワーク', '初心者向け', 'コウジの解説'],
    imagePrompt: dynamicImagePrompt
  };
}
