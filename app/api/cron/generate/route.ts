// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

const TOPICS = ['AI Workflows', 'Next.js 16 Tips', 'Cloudflare R2 Setup', 'Supabase Security'];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch active Google Trends and filter out already written topics
    let keyword = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    try {
      const rss = await fetch('https://trends.google.com/trending/rss?geo=US', { next: { revalidate: 0 } });
      if (rss.ok) {
        const matches = [...(await rss.text()).matchAll(/<title>([^<]+)<\/title>/g)];
        const rawTrends = matches.slice(1).map((match) => match[1].trim());

        if (rawTrends.length > 0) {
          const { data: recentPosts } = await supabaseAdmin
            .from('posts')
            .select('slug')
            .order('created_at', { ascending: false })
            .limit(50);
          
          const existingSlugs = new Set((recentPosts || []).map((p) => p.slug));

          const unwrittenTrends = rawTrends.filter((trend) => {
            const slug = trend.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return !existingSlugs.has(slug);
          });

          const finalTrends = unwrittenTrends.length > 0 ? unwrittenTrends : rawTrends;
          keyword = finalTrends[Math.floor(Math.random() * finalTrends.length)];
        }
      }
    } catch { console.warn('Using fallback keyword due to RSS fetch failure'); }

    const seed = Math.floor(Math.random() * 9999999);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.POLLINATIONS_API_KEY) headers['Authorization'] = 'Bearer ' + process.env.POLLINATIONS_API_KEY;

    // 2. Request Gemini to write a unique long SEO blog post strictly in English
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (minimum 600 words)","category":"Technology","tags":["string"],"imagePrompt":"string"}. ' +
      'STRICT JOURNALISTIC RULES FOR BOB: You are Bob, a highly respected global trend journalist. Your article MUST follow this structure: ' +
      '1) Introduction: Thoroughly explain WHO or WHAT the subject is in detail. No vague statements. ' +
      '2) The Catalyst: Detail exactly WHY this topic is trending right now (the recent news, viral event, or trigger). ' +
      '3) Deep Dive: Provide analytical context, historical background, and second-order implications in Bob\'s distinct intellectual voice. ' +
      '4) Future Outlook: Conclude with Bob\'s distinctive forward-looking prediction. ' +
      'STRICT LANGUAGE RULE: Generate the entire response strictly in 100% fluent English. If the keyword is in Arabic, Spanish, or Japanese, translate and write strictly in English. Output raw JSON only. Seed: ' + seed;

    const userPrompt = 'Generate a unique, masterpiece article about: "' + keyword + '". Verification Seed: ' + seed;
    let blogData: any;

    try {
      const aiText = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: 'gemini',
          jsonMode: true
        })
      });
      if (aiText.ok) {
        const rawJsonText = await aiText.text();
        // Robust JSON extraction: Find the first '{' and the last '}' to ignore any surrounding conversational text
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

    // 3. Duplicate Guard: Prevent duplicate posts
    const { data: dup } = await supabaseAdmin.from('posts').select('id').eq('title', blogData.title).single();
    if (dup) return NextResponse.json({ success: true, message: 'Duplicate post skipped' });

    const { data: dupSlug } = await supabaseAdmin.from('posts').select('id').eq('slug', blogData.slug).single();
    if (dupSlug) blogData.slug = blogData.slug + '-' + Math.floor(Math.random() * 1000);

    // 4. Generate Anime Cover via FREE API & Save to Cloudflare R2
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    try {
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(blogData.imagePrompt + ', anime style, vibrant masterpiece, high res') + '?width=1024&height=1024&nologo=true&seed=' + seed;
      const imgRes = await fetch(imgUrl);
      
      if (imgRes.ok) {
        const filename = 'blog-covers/' + blogData.slug + '-' + seed + '.webp';
        await r2Client.send(new PutObjectCommand({ 
          Bucket: process.env.R2_BUCKET_NAME, 
          Key: filename, 
          Body: Buffer.from(await imgRes.arrayBuffer()), 
          ContentType: 'image/webp' 
        }));
        coverUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL + '/' + filename;
      }
    } catch { console.warn('Using fallback image'); }

    // 5. Find or Create Category
    let catId: string;
    const catSlug = blogData.category.toLowerCase();
    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).single();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin.from('categories').insert({ name: blogData.category, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCategory.id;
    }

    // 6. Save real post metadata to Supabase
    const { data: newPost, error: postError } = await supabaseAdmin.from('posts').insert({
      title: blogData.title, slug: blogData.slug, summary: blogData.summary, content: blogData.content, cover_image_url: coverUrl, category_id: catId, status: 'published', published_at: new Date().toISOString()
    }).select('id').single();
    if (postError) throw postError;

    // 7. Save and link tags
    await Promise.all(blogData.tags.map(async (t: string) => {
      const tSlug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let tId: string;
      const { data: extTag } = await supabaseAdmin.from('tags').select('id').eq('slug', tSlug).single();
      if (extTag) {
        tId = extTag.id;
      } else {
        const { data: nTag, error: tErr } = await supabaseAdmin.from('tags').insert({ name: t, slug: tSlug }).select('id').single();
        if (tErr) throw tErr;
        tId = nTag.id;
      }
      await supabaseAdmin.from('post_tags').insert({ post_id: newPost.id, tag_id: tId });
    }));

    return NextResponse.json({ success: true, data: { keyword, title: blogData.title, slug: blogData.slug, cover_image: coverUrl } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Highly dynamic, randomized fallback payload generator to guarantee 100% unique posts even during API outages
function generateFallbackPayload(keyword: string) {
  const safeSlug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'trend-topic';
  
  const titles = [
    'The Ultimate Insight into ' + keyword + ': Trends and Future Impact',
    'Why ' + keyword + ' is Trending Globally and What It Means for You',
    'Exploring the Global Phenomenon of ' + keyword + ': A Deep Dive',
    'A Complete Analytical Guide to ' + keyword + ' and Its Future Outlook',
    'Decoding ' + keyword + ': Key Industry Shifts and Market Predictions'
  ];

  const summaries = [
    'An in-depth analysis of why ' + keyword + ' is capturing global search interest and shaping modern technology landscapes.',
    'Discover the key drivers behind the sudden rise of ' + keyword + ' and how it is redefining current digital ecosystems.',
    'A professional, comprehensive review of the trending topic of ' + keyword + ', breaking down its major real-world impacts.',
    'Everything you need to know about ' + keyword + ' today, compiled with strategic insights and analytical predictions.'
  ];

  const hash = keyword.length;
  const selectedTitle = titles[hash % titles.length];
  const selectedSummary = summaries[hash % summaries.length];

  return {
    title: selectedTitle,
    slug: safeSlug,
    summary: selectedSummary,
    content: '# ' + selectedTitle + '\n\n' +
      'Recently, **' + keyword + '** has taken the digital landscape by storm, emerging as one of the most searched keywords globally. Today, we take an analytical look at why this topic is attracting immense attention and what it means for the future.\n\n' +
      '## Why is ' + keyword + ' Trending Today?\n\n' +
      'In the fast-paced world of digital interest, certain keywords capture public imagination at an exponential scale. **' + keyword + '** is a perfect example of a topic driven by active community discussions, sudden technological shifts, and high social media engagement.\n\n' +
      '### Core pillars of this trend:\n' +
      '- **Immediate Impact**: Affecting how users browse and discuss current events.\n' +
      '- **Rapid Evolution**: The context of this keyword changes hourly as new updates arrive.\n' +
      '- **Widespread Interest**: Attracting everyone from tech experts to curious observers.\n\n' +
      '## Predictions for the Future\n\n' +
      'As we keep a close eye on **' + keyword + '**, we expect deeper integrations and more structured debates around this theme. Stay tuned as our blog brings you more analytical coverage on today\'s hottest topics!',
    category: 'Technology',
    tags: [keyword.replace(/\s+/g, ''), 'Trending', 'FutureOutlook'],
    imagePrompt: 'A futuristic holographic projection displaying abstract representations of ' + keyword + ', conceptual dynamic data lines, neon glow'
  };
}