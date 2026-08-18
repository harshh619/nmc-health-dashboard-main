import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configure Web Push with VAPID Keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

// Needs a "mailto" contact or URL
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@nmc-surveillance.org',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// We need a Service Role Key to bypass RLS when fetching all push_subscriptions in the webhook
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oysmagibpobxsipxjzpd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Ensure this is an INSERT event on the patients table
    if (payload.type === 'INSERT' && (payload.table === 'patients' || payload.table === 'patients_data')) {
      const newPatient = payload.record;
      
      const title = `New ${newPatient.Disease || 'Case'} Reported`;
      const body = `${newPatient.Patient_Name || 'A patient'} was reported in ${newPatient.Ward_Name || 'an unknown ward'}.`;
      
      const messagePayload = JSON.stringify({
        title,
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        url: '/', // Optional: URL to open when notification is clicked
        patientId: newPatient.Patient_ID
      });

      // Fetch all push subscriptions
      const { data: subscriptions, error } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*');

      if (error) {
        console.error('Error fetching subscriptions:', error);
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
      }

      if (subscriptions && subscriptions.length > 0) {
        // Broadcast the push notification to all subscribers in parallel
        const sendPromises = subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, messagePayload);
          } catch (err: any) {
            console.error(`Failed to send push to endpoint: ${sub.endpoint}`, err);
            // If the subscription is expired or invalid (410/404), delete it from our DB
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        });

        await Promise.all(sendPromises);
      }
      
      return NextResponse.json({ success: true, count: subscriptions?.length || 0 });
    }

    return NextResponse.json({ success: true, ignored: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
