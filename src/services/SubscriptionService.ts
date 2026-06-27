import { supabase } from '../lib/supabase/client';

export class SubscriptionService {
  static async getMySubscription() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('users')
      .select(
        'id, role, subscription_plan, subscription_billing, subscription_price, subscription_status, pricing_completed_at'
      )
      .eq('id', user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  static async activateSubscription(params: {
    plan: string;
    billing: string;
    price: number;
  }) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('users')
      .update({
        subscription_plan: params.plan,
        subscription_billing: params.billing,
        subscription_price: params.price,
        subscription_status: 'active',
        pricing_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
}