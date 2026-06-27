import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { IdentityVerificationService } from '../../services/IdentityVerificationService';

export const JoinExam = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length !== 8) {
      setError('Please enter a valid 8-character access code.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await IdentityVerificationService.joinExam(trimmed);

    setLoading(false);

    if (!result.success || !result.data) {
      const msg = result.error ?? 'Unable to join exam';
      if (msg.includes('invalid_code')) {
        setError('Access code not found. Please check and try again.');
      } else if (msg.includes('exam_window_not_open')) {
        setError('The exam window is not currently open.');
      } else if (msg.includes('exam_closed')) {
        setError('This exam has been closed.');
      } else if (msg.includes('already_active_session')) {
        setError('You already have an active session for this exam.');
      } else if (msg.includes('verification_blocked')) {
        setError('You have been blocked from this exam after too many failed verification attempts.');
      } else {
        setError(msg);
      }
      return;
    }

    navigate(`/exam/${result.data.session_id}/verify`, {
      state: { joinData: result.data },
    });
  };

  const handleCodeChange = (value: string) => {
    setCode(value.toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, ''));
    setError(null);
  };

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="card p-8 shadow-elevated">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient shadow-elevated mb-5 mx-auto">
            <KeyRound className="w-6 h-6 text-white" />
          </div>

          <h1 className="text-2xl font-semibold text-ink-900 text-center tracking-tight2 mb-1">
            Join exam
          </h1>
          <p className="text-sm text-ink-600 text-center mb-7">
            Enter the 8-character access code from your instructor.
          </p>

          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-danger-50 border border-danger-200 rounded-lg mb-5 animate-slide-down">
              <AlertCircle className="w-4 h-4 text-danger-700 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-danger-800">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="access-code" className="field-label text-center">
              Access code
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={8}
              placeholder="4X9MWRTP"
              className="field-input text-center text-2xl font-mono tracking-[0.4em] uppercase py-4"
              disabled={loading}
              autoComplete="off"
              aria-label="Access code"
            />
            <p className="text-2xs text-ink-500 mt-2 text-center uppercase tracking-wider">
              Letters and numbers only (I, L, O, U excluded)
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || code.length !== 8}
            className="btn btn-lg btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining…
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Join exam
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
