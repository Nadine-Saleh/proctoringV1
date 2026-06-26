import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  UploadCloud,
  Wallet,
} from 'lucide-react';

import { supabase } from '../../lib/supabase/client';
import styles from './InstructorCheckout.module.css';

type PaymentMethod = 'instapay' | 'wallet' | 'bank';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  institute: 'Institute',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  starter: '#8B1E3F',
  pro: '#8B1E3F',
  institute: '#8B1E3F',
  enterprise: '#8B1E3F',
};

export default function InstructorCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const plan = searchParams.get('plan') || 'pro';
  const billing = searchParams.get('billing') || 'monthly';
  const price = Number(searchParams.get('price') || 29);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('instapay');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planLabel = PLAN_LABELS[plan] || 'Pro';
  const themeColor = PLAN_COLORS[plan] || '#8B1E3F';

  const billingLabel = billing === 'yearly' ? 'Yearly' : 'Monthly';

  const expiresText = useMemo(() => {
    return billing === 'yearly' ? '1 year' : '1 month';
  }, [billing]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      setReceiptFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image receipt only.');
      setReceiptFile(null);
      return;
    }

    setError(null);
    setReceiptFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (!receiptFile) {
      setError('Please upload your payment receipt first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Session expired. Please login again.');
        setIsSubmitting(false);
        return;
      }

      const expiresAt =
        billing === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_billing: billing,
          subscription_price: price,
          pricing_completed_at: new Date().toISOString(),
          subscription_expires_at: expiresAt,
        })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem(
        'selectedInstructorPlan',
        JSON.stringify({
          plan,
          billing,
          price,
          status: 'active',
          fullName,
          phone,
          paymentMethod,
          activatedAt: new Date().toISOString(),
          expiresAt,
        })
      );

      navigate('/instructor', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className={styles.page}
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #fff7fa 0%, #ffffff 45%, #f7edf1 100%)',
        padding: '40px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/instructor/pricing')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            background: 'transparent',
            color: '#8B1E3F',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={18} />
          Back to plans
        </button>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          <section
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #f0d9e1',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(139, 30, 63, 0.08)',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '18px',
                background: themeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                marginBottom: '18px',
              }}
            >
              <CreditCard size={26} />
            </div>

            <h1
              style={{
                fontSize: '30px',
                lineHeight: 1.2,
                fontWeight: 800,
                color: '#171016',
                marginBottom: '8px',
              }}
            >
              Complete Your Payment
            </h1>

            <p
              style={{
                color: '#6b5d63',
                fontSize: '15px',
                marginBottom: '28px',
              }}
            >
              Upload your payment receipt to activate your instructor
              subscription.
            </p>

            {error && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: '14px',
                  marginBottom: '18px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#23161f',
                    marginBottom: '8px',
                  }}
                >
                  Full name
                </label>

                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '12px',
                    border: '1px solid #eadce2',
                    padding: '0 14px',
                    outline: 'none',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#23161f',
                    marginBottom: '8px',
                  }}
                >
                  Phone number
                </label>

                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone"
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '12px',
                    border: '1px solid #eadce2',
                    padding: '0 14px',
                    outline: 'none',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#23161f',
                    marginBottom: '10px',
                  }}
                >
                  Payment method
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                  }}
                >
                  {[
                    { id: 'instapay', label: 'InstaPay', icon: Wallet },
                    { id: 'wallet', label: 'Wallet', icon: Wallet },
                    { id: 'bank', label: 'Bank', icon: CreditCard },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = paymentMethod === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setPaymentMethod(item.id as PaymentMethod)
                        }
                        style={{
                          borderRadius: '14px',
                          border: active
                            ? `2px solid ${themeColor}`
                            : '1px solid #eadce2',
                          background: active ? '#fff6f9' : '#fff',
                          padding: '14px 10px',
                          cursor: 'pointer',
                          color: active ? themeColor : '#5f5258',
                          fontWeight: 700,
                        }}
                      >
                        <Icon size={20} />
                        <div style={{ marginTop: '6px', fontSize: '13px' }}>
                          {item.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '26px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#23161f',
                    marginBottom: '10px',
                  }}
                >
                  Upload payment receipt
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '2px dashed #d9b9c5',
                    borderRadius: '18px',
                    padding: '28px',
                    background: '#fff9fb',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {receiptFile ? (
                    <>
                      <CheckCircle2 color={themeColor} size={30} />
                      <strong style={{ color: '#23161f' }}>
                        {receiptFile.name}
                      </strong>
                      <span style={{ color: '#6b5d63', fontSize: '13px' }}>
                        Receipt uploaded successfully
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud color={themeColor} size={34} />
                      <strong style={{ color: '#23161f' }}>
                        Click to upload receipt
                      </strong>
                      <span style={{ color: '#6b5d63', fontSize: '13px' }}>
                        PNG, JPG, or JPEG
                      </span>
                    </>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '16px',
                  border: 'none',
                  background: themeColor,
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.75 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Activating subscription...
                  </>
                ) : (
                  'Submit Payment & Continue'
                )}
              </button>
            </form>
          </section>

          <aside
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #f0d9e1',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(139, 30, 63, 0.08)',
              position: 'sticky',
              top: '24px',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: themeColor,
                marginBottom: '10px',
              }}
            >
              Order summary
            </p>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#171016',
                marginBottom: '8px',
              }}
            >
              {planLabel} Plan
            </h2>

            <p
              style={{
                color: '#6b5d63',
                fontSize: '14px',
                marginBottom: '22px',
              }}
            >
              {billingLabel} billing · Valid for {expiresText}
            </p>

            <div
              style={{
                borderTop: '1px solid #f0d9e1',
                borderBottom: '1px solid #f0d9e1',
                padding: '18px 0',
                marginBottom: '18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  color: '#6b5d63',
                }}
              >
                <span>Plan</span>
                <strong style={{ color: '#23161f' }}>{planLabel}</strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  color: '#6b5d63',
                }}
              >
                <span>Billing</span>
                <strong style={{ color: '#23161f' }}>{billingLabel}</strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#6b5d63',
                }}
              >
                <span>Status after submit</span>
                <strong style={{ color: themeColor }}>Active</strong>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span
                style={{
                  color: '#6b5d63',
                  fontWeight: 700,
                }}
              >
                Total
              </span>

              <strong
                style={{
                  color: '#171016',
                  fontSize: '34px',
                  fontWeight: 900,
                }}
              >
                ${price}
              </strong>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}