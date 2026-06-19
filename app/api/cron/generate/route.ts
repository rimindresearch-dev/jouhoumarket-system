// app/api/cron/generate/route.ts
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../../../lib/r2';
import { supabaseAdmin } from '../../../../lib/supabase';

interface GeneratedBlogPayload {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  imagePrompt: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    const rssUrl = 'https://trends.google.com/trending/rss?geo=US';
    const rssResponse = await fetch(rssUrl, { next: { revalidate: 0 } });
    if (!rssResponse.ok) {
      throw new Error(`Google Trends returned status: ${rssResponse.status}`);
    }

    const rssText = await rssResponse.text();
    const titleMatches = [...rssText.matchAll(/<title>([^<]+)<\/title>/g)];
    const rawTrends = titleMatches.slice(1).map((match) => match[1].trim());

    if (rawTrends.length === 0) {
      throw new Error('No trends found in RSS body');
    }

    const randomIndex = Math.floor(Math.random() * rawTrends.length);
    const selectedKeyword = rawTrends[randomIndex];

    const apiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.POLLINATIONS_API_KEY) {
      apiHeaders['Authorization'] = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
    }

    const systemPrompt = `You are an elite automated blog writer. Write a comprehensive, SEO-friendly blog post based on the keyword.
Return ONLY a valid JSON object matching this schema:
{
  "title": "string",
  "slug": "url-friendly-slug-lowercase",
  "summary": "captivating and professional short summary",
  "content": "extremely detailed blog post in rich Markdown, minimum 600 words",
  "category": "Technology" | "Lifestyle" | "Finance",
  "tags": ["tag1", "tag2"],
  "imagePrompt": "vivid descriptive scene description for the post header"
}
Rules: Return raw JSON only. Do not wrap in markdown or markdown JSON blocks.`;

    const userPrompt = `Generate a unique, masterpiece article about: "${selectedKeyword}".`;

    const aiTextResponse = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'openai'
      })
    });

    if (!aiTextResponse.ok) {
      throw new Error(`AI Text Generator failed: ${aiTextResponse.statusText}`);
    }

    const rawJsonText = await aiTextResponse.text();
    const cleanJson = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const blogData: GeneratedBlogPayload = JSON.parse(cleanJson);

    const { data: existingPost } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('slug', blogData.slug)
      .single();

    if (existingPost) {
      blogData.slug = `${blogData.slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const stylizedPrompt = `${blogData.imagePrompt}, vibrant anime illustration style, highly detailed digital art, masterfully colored, aesthetic lighting, high resolution, clean lines`;
    const imageGenerationSeed = Math.floor(Math.random() * 9999999);
    const encodedPrompt = encodeURIComponent(stylizedPrompt);
    const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&nologo=true&seed=${imageGenerationSeed}&key=${process.env.POLLINATIONS_API_KEY}`;

    const imageFetchOptions: RequestInit = { next: { revalidate: 0 } };
    if (process.env.POLLINATIONS_API_KEY) {
      imageFetchOptions.headers = {
        'Authorization': 'Bearer ' + process.env.POLLINATIONS_API_KEY
      };
    }

    const imageResponse = await fetch(imageUrl, imageFetchOptions);
    if (!imageResponse.ok) {
      throw new Error(`Failed to generate cover illustration: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const filename = `blog-covers/${blogData.slug}-${imageGenerationSeed}.webp`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/webp',
      })
    );

    const publicCoverImageUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${filename}`;

    let categoryId: string;
    const categorySlug = blogData.category.toLowerCase();
    
    const { data: existingCategory } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      const { data: newCategory, error: catError } = await supabaseAdmin
        .from('categories')
        .insert({ name: blogData.category, slug: categorySlug })
        .select('id')
        .single();

      if (catError) throw catError;
      categoryId = newCategory.id;
    }

    const { data: insertedPost, error: postError } = await supabaseAdmin
      .from('posts')
      .insert({
        title: blogData.title,
        slug: blogData.slug,
        summary: blogData.summary,
        content: blogData.content,
        cover_image_url: publicCoverImageUrl,
        category_id: categoryId,
        status: 'published',
        published_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (postError) throw postError;

    const tagPromises = blogData.tags.map(async (tagName) => {
      const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let tagId: string;

      const { data: existingTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('slug', tagSlug)
        .single();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: tagError } = await supabaseAdmin
          .from('tags')
          .insert({ name: tagName, slug: tagSlug })
          .select('id')
          .single();

        if (tagError) throw tagError;
        tagId = newTag.id;
      }

      await supabaseAdmin
        .from('post_tags')
        .insert({ post_id: insertedPost.id, tag_id: tagId });
    });

    await Promise.all(tagPromises);

    return NextResponse.json({
      success: true,
      message: 'Blog post generated and published successfully',
      data: {
        keyword: selectedKeyword,
        title: blogData.title,
        slug: blogData.slug,
        cover_image: publicCoverImageUrl,
      }
    });

  } catch (error: any) {
    console.error('Autopilot generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
