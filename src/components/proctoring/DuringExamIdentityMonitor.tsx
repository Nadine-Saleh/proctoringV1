import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { IdentityVerificationService } from '../../services/IdentityVerificationService';

type IdentityStatus = 'normal' | 'warning' | 'flagged';

export function DuringExamIdentityMonitor() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const failuresRef = useRef(0);

  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('normal');
  const [identityWarning, setIdentityWarning] = useState('');
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [passedChecks, setPassedChecks] = useState(0);
  const [failedChecks, setFailedChecks] = useState(0);

  async function runDuringExamIdentityCheck() {
    try {
      const videoEl = videoRef.current;

      if (!videoEl) {
        return;
      }

      if (videoEl.readyState < 2) {
        console.warn('Identity video is not ready yet');
        return;
      }

      const embedding = await IdentityVerificationService.extractEmbedding(videoEl);

      if (!embedding) {
        failuresRef.current += 1;
        setFailedChecks((prev) => prev + 1);
        setIdentityStatus('warning');
        setIdentityWarning(
          `Face not detected clearly. Failed checks: ${failuresRef.current}/3`
        );

        if (failuresRef.current >= 3) {
          setIdentityStatus('flagged');
          setIdentityWarning(
            'Exam flagged: identity could not be verified during the exam.'
          );
        }

        return;
      }

      const result = await IdentityVerificationService.verifyDuringExam(embedding);

      if (!result.success || !result.data) {
        failuresRef.current += 1;
        setFailedChecks((prev) => prev + 1);
        setIdentityStatus('warning');
        setIdentityWarning(
          result.error || 'Identity verification failed during exam.'
        );

        if (failuresRef.current >= 3) {
          setIdentityStatus('flagged');
          setIdentityWarning(
            'Exam flagged: identity verification failed 3 times.'
          );
        }

        return;
      }

      console.log('During exam identity result:', result.data);

      setLastConfidence(result.data.confidence);

      if (result.data.outcome === 'pass') {
        failuresRef.current = 0;
        setPassedChecks((prev) => prev + 1);
        setIdentityStatus('normal');
        setIdentityWarning('');
        return;
      }

      failuresRef.current += 1;
      setFailedChecks((prev) => prev + 1);
      setIdentityStatus('warning');

      setIdentityWarning(
        `Different person suspected. Confidence: ${Math.round(
          result.data.confidence * 100
        )}%. Failed checks: ${failuresRef.current}/3`
      );

      if (failuresRef.current >= 3) {
        setIdentityStatus('flagged');
        setIdentityWarning(
          'Exam flagged: different person suspected during the exam.'
        );
      }
    } catch (error) {
      console.error('During exam identity check error:', error);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function startIdentityCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        timerRef.current = window.setInterval(() => {
          runDuringExamIdentityCheck();
        }, 10000); // 10 seconds for testing

        console.log('During exam identity monitoring started');
      } catch (error) {
        console.error('Could not start identity camera:', error);
        setIdentityStatus('warning');
        setIdentityWarning(
          'Camera is required for identity monitoring during the exam.'
        );
      }
    }

    startIdentityCamera();

    return () => {
      isMounted = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          left: '-9999px',
          top: '-9999px',
        }}
      />

      <div
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: 9999,
          width: '320px',
          background: '#ffffff',
          border:
            identityStatus === 'flagged'
              ? '2px solid #dc2626'
              : identityStatus === 'warning'
              ? '2px solid #f59e0b'
              : '2px solid #16a34a',
          borderRadius: '12px',
          padding: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          fontSize: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            fontWeight: 700,
          }}
        >
          {identityStatus === 'flagged' ? (
            <ShieldAlert size={20} color="#dc2626" />
          ) : identityStatus === 'warning' ? (
            <AlertTriangle size={20} color="#f59e0b" />
          ) : (
            <CheckCircle size={20} color="#16a34a" />
          )}

          <span>During Exam Identity Monitor</span>
        </div>

        <div style={{ lineHeight: '1.7' }}>
          <div>
            Status:{' '}
            <strong
              style={{
                color:
                  identityStatus === 'flagged'
                    ? '#dc2626'
                    : identityStatus === 'warning'
                    ? '#d97706'
                    : '#16a34a',
              }}
            >
              {identityStatus}
            </strong>
          </div>

          <div>Passed checks: {passedChecks}</div>
          <div>Failed checks: {failedChecks}</div>

          {lastConfidence !== null && (
            <div>Last confidence: {Math.round(lastConfidence * 100)}%</div>
          )}

          {identityWarning && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px',
                borderRadius: '8px',
                background:
                  identityStatus === 'flagged' ? '#fee2e2' : '#fef3c7',
                color:
                  identityStatus === 'flagged' ? '#991b1b' : '#92400e',
              }}
            >
              {identityWarning}
            </div>
          )}
        </div>
      </div>
    </>
  );
}