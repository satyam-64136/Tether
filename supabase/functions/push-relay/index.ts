import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_MAILTO = Deno.env.get('VAPID_MAILTO') || 'mailto:you@example.com';

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  // Only accept POST from Supabase webhook
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  try {
    const payload = await req.json();

    // Supabase database webhook sends { type, table, record, ... }
    const msg = payload.record;
    if (!msg || payload.type !== 'INSERT') {
      return new Response('not an insert', { status: 200 });
    }

    // Don't notify for deleted messages
    if (msg.deleted) return new Response('deleted', { status: 200 });

    // Recipient is whoever is NOT the sender
    const recipient = msg.sender === 'Satyam' ? 'Snks' : 'Satyam';

    // Look up their push subscription
    const { data: sub, error } = await sb
      .from('push_subscriptions')
      .select('subscription')
      .eq('username', recipient)
      .maybeSingle();

    if (error || !sub?.subscription) {
      return new Response('no subscription', { status: 200 });
    }

    // Build notification body
    const isVideo = /\.(mp4|mov|webm|mkv|avi|m4v)(\?|$)/i.test(msg.image_url || '');
    const body = isVideo
      ? '🎥 sent a video'
      : msg.image_url
      ? '📷 sent a photo'
      : msg.content || '…';

    const notifPayload = JSON.stringify({
      title: msg.sender,
      body,
      url: '/Tether/'
    });

    await webpush.sendNotification(sub.subscription, notifPayload);

    return new Response('sent', { status: 200 });

  } catch (err) {
    // Log but don't crash — always return 200 so Supabase doesn't retry endlessly
    console.error('push-relay error:', err);
    return new Response('error', { status: 200 });
  }
});
