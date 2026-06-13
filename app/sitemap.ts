// app/sitemap.ts
import { MetadataRoute } from 'next';
import { supabase } from '../lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at');

  const postUrls = (posts || []).map((post) => ({
    url: baseUrl + '/posts/' + post.slug,
    lastModified: new Date(post.updated_at || Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...postUrls,
  ];
}
