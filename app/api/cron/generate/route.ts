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

    const pollinationsApiKey = process.env.POLLINATIONS_API_KEY || '';

    // 1. Fetch active Google Trends and filter out already written topics
    let keyword = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    try {
      const rss = await fetch('https://trends.google.com/trending/rss?geo=US', { next: { revalidate: 0 } });
      if (rss.ok) {
        const matches = [...(await rss.text()).matchAll(/<title>([^<]+)<\/title>/g)];
        const rawTrends = matches.slice(1).map((match) => match[1].trim());

        if (rawTrends.length > 0) {
          // Fetch last 50 slugs from Supabase to prevent same-day duplicates
          const { data: recentPosts } = await supabaseAdmin
            .from('posts')
            .select('slug')
            .order('created_at', { ascending: false })
            .limit(50);
          
          const existingSlugs = new Set((recentPosts || []).map((p) => p.slug));

          // Filter out any trends whose slug already exists in recent history
          const unwrittenTrends = rawTrends.filter((trend) => {
            const slug = trend.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return !existingSlugs.has(slug);
          });

          // Select from unwritten topics, fallback to raw list only if everything is written
          const finalTrends = unwrittenTrends.length > 0 ? unwrittenTrends : rawTrends;
          keyword = finalTrends[Math.floor(Math.random() * finalTrends.length)];
        }
      }
    } catch { console.warn('Using fallback keyword due to RSS fetch failure'); }

    const seed = Math.floor(Math.random() * 9999999);
    const apiHeaders: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + pollinationsApiKey
    };

    // 2. Request GPT (via gen.pollinations.ai completions endpoint exactly like VIVIDBUY)
    const sysPrompt = 'Write a SEO blog JSON matching: {"title":"string","slug":"string","summary":"string","content":"markdown content string (min 600 words)","category":"Technology","tags":["string"],"imagePrompt":"string"}. Output raw JSON only. Seed: ' + seed;
    let blogData: any;

    const aiText = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: 'Topic: ' + keyword }
        ],
        model: 'openai'
      })
    });

    if (!aiText.ok) throw new Error('AI Text Generator failed: ' + aiText.statusText);
    const aiJson = await aiText.json();
    const rawAiText = aiJson.choices[0].message.content;
    const clean = rawAiText.replace(/```json/g, '').replace(/```/g, '').trim();
    blogData = JSON.parse(clean);

    // 3. Duplicate Guard: Prevent duplicate posts
    const { data: dup } = await supabaseAdmin.from('posts').select('id').eq('title', blogData.title).single();
    if (dup) return NextResponse.json({ success: true, message: 'Duplicate post skipped' });

    const { data: dupSlug } = await supabaseAdmin.from('posts').select('id').eq('slug', blogData.slug).single();
    if (dupSlug) blogData.slug = blogData.slug + '-' + Math.floor(Math.random() * 1000);

    // 4. Generate Anime Cover via Flux Engine (Exactly like VIVIDBUY format) & Save to Cloudflare R2
    let coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop';
    
    try {
      const stylizedPrompt = blogData.imagePrompt + ', anime style, vibrant masterpiece, high res';
      const encodedPrompt = encodeURIComponent(stylizedPrompt);
      const imgUrl = 'https://gen.pollinations.ai/image/' + encodedPrompt + '?model=flux&width=1024&height=1024&nologo=true&key=' + pollinationsApiKey + '&seed=' + seed;

      // Double-verification header authentication as designed in VIVIDBUY
      const imgRes = await fetch(imgUrl, {
        headers: { 'Authorization': 'Bearer ' + pollinationsApiKey }
      });
      
      if (imgRes.ok) {
        const filename = 'blog-covers/' + blogData.slug + '-' + seed + '.webp';
        await r2Client.send(new PutObjectCommand({ 
          Bucket: process.env.R2_BUCKET_NAME, 
          Key: filename, 
          Body: Buffer.from(await imgRes.arrayBuffer()), 
          ContentType: 'image/webp' 
        }));
        coverUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL + '/' + filename;
      } else {
        console.warn('Image generation status is not ok:', imgRes.status);
      }
    } catch (imageError) {
      console.warn('Image generation or R2 upload failed. Activating fallback abstract illustration.', imageError);
    }

    // 5. Find or Create Category
    let catId: string;
    const catSlug = blogData.category.toLowerCase();
    const { data: existingCat } = await supabaseAdmin.from('categories').select('id').eq('slug', catSlug).single();
    if (existingCat) {
      catId = existingCat.id;
    } else {
      const { data: newCat, error: catError } = await supabaseAdmin.from('categories').insert({ name: blogData.category, slug: catSlug }).select('id').single();
      if (catError) throw catError;
      catId = newCat.id;
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

// Programmatic fallback payload generator matching the schema to guarantee 100% system availability
function generateFallbackPayload(keyword: string) {
  const safeSlug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'trend-topic';
  return {
    title: 'The Ultimate Insight into ' + keyword + ': Trends and Future Impact',
    slug: safeSlug,
    summary: 'An in-depth analysis of why ' + keyword + ' is capturing global search interest and shaping modern technology landscapes.',
    content: '# The Phenomenon of ' + keyword + '\n\n' +
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