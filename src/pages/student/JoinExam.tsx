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
    setCode(value.toUpperCase().replace(/[^0-9A-HJ-NPR-Z]/g, ''));
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-xl mb-6 mx-auto">
            <KeyRound className="w-7 h-7 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Join Exam</h1>
          <p className="text-gray-500 text-center mb-8">
            Enter the 8-character access code provided by your instructor.
          </p>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="access-code" className="block text-sm font-medium text-gray-700 mb-2">
              Access Code
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={8}
              placeholder="e.g. 4X9MWRTP"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase"
              disabled={loading}
              autoComplete="off"
              aria-label="Access code"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Numbers and letters only (I, L, O, U excluded)
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || code.length !== 8}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining…
              </>
            ) : (
              'Join Exam'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
