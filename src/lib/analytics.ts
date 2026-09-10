/**
 * Tillora Growth Intelligence & Analytics Abstraction
 * This module provides a unified interface for tracking user behavior, 
 * conversions, and system events without binding to a specific provider.
 */

type EventParams = Record<string, string | number | boolean | null | undefined>;

class Analytics {
  private static instance: Analytics;
  private isInitialized = false;

  private constructor() {
    // In production, you would initialize your SDKs here (e.g., Mixpanel, PostHog, GA4)
    if (typeof window !== 'undefined') {
      this.isInitialized = true;
      console.log('[Tillora Analytics] Growth Intelligence initialized.');
    }
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  /**
   * Track a generic event with custom parameters
   */
  public track(eventName: string, params: EventParams = {}) {
    if (!this.isInitialized) return;

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Tillora Analytics] Event: ${eventName}`, params);
    }

    // Example: window.gtag?.('event', eventName, params);
  }

  /**
   * Specialized method for conversion tracking (e.g. sign-ups, demo requests)
   */
  public trackConversion(type: 'signup' | 'demo' | 'sale', value?: number, currency = 'USD') {
    this.track('conversion', {
      conversion_type: type,
      value: value || 0,
      currency: currency,
    });
  }

  /**
   * Track page views
   */
  public pageView(path: string) {
    this.track('page_view', { path });
  }

  /**
   * Identity tracking for logged-in users
   */
  public identify(userId: string, traits: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Tillora Analytics] Identity: ${userId}`, traits);
    }
    
    // Example: mixpanel.identify(userId);
  }
}

export const analytics = Analytics.getInstance();
