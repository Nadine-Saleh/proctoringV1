import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, ShieldCheck, ChevronDown } from 'lucide-react';
import styles from './InstructorPricing.module.css';

type Plan = {
  id: string;
  name: string;
  monthly: number;
  yearly: number;
  featured?: boolean;
  features: {
    text: string;
    included: boolean;
  }[];
};

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 9,
    yearly: 86,
    features: [
      { text: 'Create Exams', included: true },
      { text: 'Proctoring Reports', included: false },
      { text: 'Real-time Monitor', included: false },
      { text: 'Export PDF/CSV', included: false },
      { text: 'API Access', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 29,
    yearly: 278,
    featured: true,
    features: [
      { text: 'Create Exams', included: true },
      { text: 'Proctoring Reports', included: true },
      { text: 'Real-time Monitor', included: true },
      { text: 'Export PDF/CSV', included: false },
      { text: 'API Access', included: false },
    ],
  },
  {
    id: 'institute',
    name: 'Institute',
    monthly: 79,
    yearly: 758,
    features: [
      { text: 'Create Exams', included: true },
      { text: 'Proctoring Reports', included: true },
      { text: 'Real-time Monitor', included: true },
      { text: 'Export PDF/CSV', included: true },
      { text: 'API Access', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 199,
    yearly: 1910,
    features: [
      { text: 'Create Exams', included: true },
      { text: 'Proctoring Reports', included: true },
      { text: 'Real-time Monitor', included: true },
      { text: 'Export PDF/CSV', included: true },
      { text: 'API Access', included: true },
    ],
  },
];

const FEATURE_ROWS = [
  {
    label: 'Create Exams',
    starter: true,
    pro: true,
    institute: true,
    enterprise: true,
  },
  {
    label: 'Proctoring Reports',
    starter: false,
    pro: true,
    institute: true,
    enterprise: true,
  },
  {
    label: 'Real-time Monitor',
    starter: false,
    pro: true,
    institute: true,
    enterprise: true,
  },
  {
    label: 'Export PDF/CSV',
    starter: false,
    pro: false,
    institute: true,
    enterprise: true,
  },
  {
    label: 'API Access',
    starter: false,
    pro: false,
    institute: false,
    enterprise: true,
  },
];

const FAQS = [
  {
    q: 'Can I change my plan later?',
    a: 'Yes, you can change your plan later from your instructor account.',
  },
  {
    q: 'Is this a real payment gateway?',
    a: 'This is a demo payment flow for the project. It simulates payment and receipt upload.',
  },
  {
    q: 'When can I create exams?',
    a: 'After submitting the payment receipt, the system redirects you to the instructor dashboard.',
  },
];

export default function InstructorPricing() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>Instructor Subscription</div>

        <h1 className={styles.title}>Choose your Examify plan</h1>

        <p className={styles.subtitle}>
          Select a plan, complete payment, then start creating secure exams.
        </p>

        <div className={styles.toggleWrap}>
          <span className={`${styles.toggleLabel} ${!yearly ? styles.active : ''}`}>
            Monthly
          </span>

          <button
            type="button"
            className={`${styles.toggleBtn} ${yearly ? styles.yearly : ''}`}
            onClick={() => setYearly((prev) => !prev)}
          >
            <span className={styles.thumb} />
          </button>

          <span className={`${styles.toggleLabel} ${yearly ? styles.active : ''}`}>
            Yearly
          </span>

          <span
            className={`${styles.saveBadge} ${
              yearly ? styles.saveBadgeVisible : ''
            }`}
          >
            Save 20%
          </span>
        </div>
      </header>

      <section className={styles.grid}>
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly;
          const billing = yearly ? 'yearly' : 'monthly';

          return (
            <article
              key={plan.id}
              className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
            >
              {plan.featured && (
                <div className={styles.popularBadge}>Most Popular</div>
              )}

              <h2 className={styles.planName}>{plan.name}</h2>

              <div className={styles.priceRow}>
                <span className={styles.currency}>$</span>
                <span className={styles.priceNum}>{price}</span>
                <span className={styles.period}>
                  / {yearly ? 'year' : 'month'}
                </span>
              </div>

              <hr className={styles.divider} />

              <ul className={styles.featureList}>
                {plan.features.map((feature) => (
                  <li
                    key={feature.text}
                    className={feature.included ? styles.ok : styles.no}
                  >
                    {feature.included ? (
                      <Check className={styles.featureIcon} />
                    ) : (
                      <Minus className={styles.featureIcon} />
                    )}

                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>

             <Link
  className={`${styles.ctaBtn} ${
    plan.featured ? styles.ctaPrimary : ''
  }`}
  to={`/checkout?plan=${plan.id}&billing=${billing}&price=${price}`}
>
  {plan.featured
    ? 'Start Free Trial'
    : plan.id === 'enterprise'
      ? 'Contact Us'
      : 'Get Started'}
</Link>
            </article>
          );
        })}
      </section>

      <div className={styles.guarantee}>
        <ShieldCheck size={18} />
        <span>14-day money-back guarantee — no questions asked</span>
      </div>

      <section className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>Feature comparison</h2>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Pro</th>
                <th>Institute</th>
                <th>Enterprise</th>
              </tr>
            </thead>

            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>

                  <td>
                    {row.starter ? (
                      <Check className={styles.iconOk} />
                    ) : (
                      <Minus className={styles.iconNo} />
                    )}
                  </td>

                  <td>
                    {row.pro ? (
                      <Check className={styles.iconOk} />
                    ) : (
                      <Minus className={styles.iconNo} />
                    )}
                  </td>

                  <td>
                    {row.institute ? (
                      <Check className={styles.iconOk} />
                    ) : (
                      <Minus className={styles.iconNo} />
                    )}
                  </td>

                  <td>
                    {row.enterprise ? (
                      <Check className={styles.iconOk} />
                    ) : (
                      <Minus className={styles.iconNo} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.faq}>
        <h2 className={`${styles.sectionTitle} ${styles.centerTitle}`}>
          Frequently asked questions
        </h2>

        {FAQS.map((item, index) => (
          <div key={item.q} className={styles.faqItem}>
            <button
              type="button"
              className={styles.faqQ}
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
            >
              <span>{item.q}</span>

              <ChevronDown
                className={`${styles.chevron} ${
                  openFaq === index ? styles.rotated : ''
                }`}
              />
            </button>

            {openFaq === index && <p className={styles.faqA}>{item.a}</p>}
          </div>
        ))}
      </section>
    </main>
  );
}