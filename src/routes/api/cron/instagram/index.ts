import type { RequestHandler } from '@builder.io/qwik-city';
import { getDB } from '~/db';
import { instagramPosts } from '~/db/schema';

export const onGet: RequestHandler = async (requestEvent) => {
  const { env, request, json } = requestEvent;

  // Security verification to ensure only authorized callers (e.g., Vercel Cron) can run this endpoint.
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.get('CRON_SECRET');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    json(401, { error: 'Unauthorized' });
    return;
  }

  try {
    const res = await fetch('https://feeds.behold.so/tTcVjk6ooAq94BPJcVRi', {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      json(res.status, { error: 'Failed to fetch Instagram feed' });
      return;
    }

    const data = (await res.json()) as {
      posts?: Array<{
        id: string;
        mediaUrl?: string;
        permalink?: string;
        caption?: string;
        mediaType?: string;
        thumbnailUrl?: string;
        timestamp?: string;
      }>;
    };

    if (!data.posts || data.posts.length === 0) {
      json(200, { success: true, count: 0 });
      return;
    }

    // Limit to the top 12 recent posts to not saturate the DB
    const topPosts = data.posts.slice(0, 12);

    const postsToInsert = topPosts.map(post => {
      // Use thumbnailUrl if it's a video, else mediaUrl
      const imageUrl = (post.mediaType === 'VIDEO' && post.thumbnailUrl)
        ? post.thumbnailUrl
        : post.mediaUrl;

      return {
        id: post.id,
        permalink: post.permalink || '',
        mediaUrl: imageUrl || '',
        mediaType: post.mediaType || 'IMAGE',
        caption: post.caption || '',
        timestamp: post.timestamp || new Date().toISOString(),
      };
    }).filter(p => p.id && p.mediaUrl && p.permalink);

    if (postsToInsert.length === 0) {
      json(200, { success: true, count: 0, message: 'No valid posts to insert' });
      return;
    }

    const db = getDB(requestEvent);

    // Delete previous posts and insert the new cacheable ones
    await db.delete(instagramPosts);
    await db.insert(instagramPosts).values(postsToInsert);

    json(200, { success: true, count: postsToInsert.length });
  } catch (err: any) {
    json(500, { error: 'Internal Server Error', message: err.message });
  }
};
