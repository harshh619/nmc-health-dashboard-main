'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserSession } from '../lib/types';

interface PushNotificationManagerProps {
  userSession?: UserSession | null;
}

// Convert VAPID public key to Uint8Array for Web Push API
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager({ userSession }: PushNotificationManagerProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const handleToggleSubscription = async () => {
    setIsLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (err) {
      console.error('Subscription error:', err);
      alert('Failed to toggle push notifications. See console.');
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = async () => {
    if (Notification.permission === 'denied') {
      alert('You have blocked notifications. Please unblock them in your browser settings.');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      alert('Push notifications are not fully configured yet (Missing VAPID key).');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Save to Supabase
    const subJSON = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').insert({
      username: userSession?.username || 'anonymous',
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys?.p256dh,
      auth: subJSON.keys?.auth
    });

    if (error) {
      // If constraint error (already exists), it's fine
      if (error.code !== '23505') {
        console.error('Failed to save subscription to Supabase:', error);
      }
    }

    setIsSubscribed(true);
  };

  const unsubscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove from Supabase
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
    }
    setIsSubscribed(false);
  };

  if (!isSupported) {
    return (
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-red-100 text-red-700">
        Push Not Supported
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleSubscription}
      disabled={isLoading}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
        isSubscribed
          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-800/60 shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
      }`}
      title={isSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications'}
    >
      {isSubscribed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">
        {isLoading ? 'Wait...' : isSubscribed ? 'Notifications On' : 'Enable Notifications'}
      </span>
    </button>
  );
}
