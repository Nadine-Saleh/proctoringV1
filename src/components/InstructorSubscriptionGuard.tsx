import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SubscriptionService } from '../services/SubscriptionService';

export function InstructorSubscriptionGuard({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSubscription() {
      const result = await SubscriptionService.getMySubscription();

      if (!mounted) return;

      if (
        result.success &&
        result.data?.subscription_status === 'active' &&
        result.data?.pricing_completed_at
      ) {
        setHasSubscription(true);
      } else {
        setHasSubscription(false);
      }

      setIsLoading(false);
    }

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-10 h-10 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-brand-100" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-700 animate-spin" />
          </div>
          <p className="text-sm text-ink-600">Checking subscription…</p>
        </div>
      </div>
    );
  }

  if (!hasSubscription) {
    return <Navigate to="/instructor/pricing" replace />;
  }

  return <>{children}</>;
}