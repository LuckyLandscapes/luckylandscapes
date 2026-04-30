'use client';

// Records a voice memo from the device microphone while live-transcribing
// what's said via the Web Speech API. Designed for a walkthrough where the
// estimator narrates what the customer is asking for ("they want this bed
// torn out, mulch refreshed, edge along the driveway…") and the gallery
// holds the audio + the spoken transcript together.
//
// Web Speech API is browser-native and free. Supported on Chrome (Android),
// Edge, and Safari 14.1+/iOS — i.e. the actual phones field crew will use.
// On unsupported browsers we still record the audio, just without a live
// transcript (the user can type one in the caption afterward).

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, Trash2, Check } from 'lucide-react';

const MAX_DURATION_SEC = 5 * 60; // 5 minutes hard cap

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

// Pick a MediaRecorder MIME type the current browser actually supports.
// iOS Safari prefers mp4/aac; Chrome/Android prefer webm/opus. Falling back
// to "no mimeType arg" lets the browser pick its native default.
function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export default function VoiceMemoRecorder({ onSave, onCancel }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'recording' | 'review'
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const speechRef = useRef(null);
  const startedAtRef = useRef(null);
  const tickRef = useRef(null);
  const finalTextRef = useRef('');

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechSupported(!!SR);
  }, []);

  useEffect(() => {
    return () => {
      // Component unmount cleanup
      try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { speechRef.current?.stop(); } catch {}
      clearInterval(tickRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    setInterim('');
    setDuration(0);
    finalTextRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickAudioMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blobType = recorder.mimeType || 'audio/webm';
        const ext = blobType.includes('mp4') ? 'm4a' : blobType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        const file = new File([blob], `voice-memo-${Date.now()}.${ext}`, { type: blobType });
        const url = URL.createObjectURL(blob);
        setAudioFile(file);
        setAudioUrl(url);
        setPhase('review');
      };
      recorder.start();

      // Live transcription
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = 'en-US';
        sr.onresult = (e) => {
          let interimText = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const piece = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalTextRef.current += piece + ' ';
            else interimText += piece;
          }
          setTranscript(finalTextRef.current);
          setInterim(interimText);
        };
        sr.onerror = (e) => {
          // Most common: 'not-allowed' or 'no-speech'. Don't kill the recording —
          // the user can still narrate without a transcript.
          if (e.error && e.error !== 'no-speech') console.warn('[VoiceMemo] speech error:', e.error);
        };
        sr.onend = () => {
          // The API auto-ends after a pause on some browsers; restart while we're
          // still recording so it keeps capturing.
          if (recorderRef.current?.state === 'recording') {
            try { sr.start(); } catch {}
          }
        };
        try { sr.start(); speechRef.current = sr; } catch (err) {
          console.warn('[VoiceMemo] speech start failed:', err);
        }
      }

      startedAtRef.current = Date.now();
      tickRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(sec);
        if (sec >= MAX_DURATION_SEC) stopRecording();
      }, 250);
      setPhase('recording');
    } catch (err) {
      setError(err.message || 'Microphone permission denied.');
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { speechRef.current?.stop(); } catch {}
    clearInterval(tickRef.current);
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFile(null);
    setTranscript('');
    setInterim('');
    setDuration(0);
    setPhase('idle');
  };

  const save = () => {
    if (!audioFile) return;
    onSave({
      file: audioFile,
      durationSeconds: duration,
      transcript: (transcript + interim).trim(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2><Mic size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Voice Memo</h2>
          <button className="btn btn-icon btn-ghost" onClick={onCancel} disabled={phase === 'recording'}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {!speechSupported && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-tertiary)',
              padding: 'var(--space-sm)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-md)',
            }}>
              Live transcription isn&apos;t available on this browser — the audio will still record. You can type the customer&apos;s notes in the caption after saving.
            </div>
          )}

          {error && (
            <div style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--status-danger-bg)',
              color: 'var(--status-danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-md)',
            }}>{error}</div>
          )}

          {phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                Tap to start recording. Narrate what the customer is asking for during the walkthrough — we&apos;ll save the audio and a live transcript.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={startRecording}
                style={{ borderRadius: '999px', width: 84, height: 84, padding: 0, justifyContent: 'center' }}
              >
                <Mic size={32} />
              </button>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                Max {MAX_DURATION_SEC / 60} min
              </div>
            </div>
          )}

          {phase === 'recording' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--status-danger)', marginBottom: 'var(--space-md)' }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--status-danger)', marginRight: 10,
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
                {fmtTime(duration)}
              </div>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                onClick={stopRecording}
                style={{ borderRadius: '999px', width: 84, height: 84, padding: 0, justifyContent: 'center' }}
              >
                <Square size={28} />
              </button>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>Tap to stop</div>

              {(transcript || interim) && (
                <div style={{
                  marginTop: 'var(--space-lg)',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                  textAlign: 'left',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live transcript</div>
                  <span>{transcript}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{interim}</span>
                </div>
              )}
            </div>
          )}

          {phase === 'review' && audioUrl && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                Recorded {fmtTime(duration)}
              </div>
              <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 'var(--space-md)' }} />
              <div className="form-group">
                <label className="form-label">Transcript {speechSupported && '(auto-generated — edit as needed)'}</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={transcript + (interim ? ' ' + interim : '')}
                  onChange={(e) => { setTranscript(e.target.value); setInterim(''); }}
                  placeholder="Notes from the walkthrough..."
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {phase === 'review' ? (
            <>
              <button className="btn btn-secondary" onClick={discard}>
                <Trash2 size={16} /> Discard
              </button>
              <button className="btn btn-primary" onClick={save}>
                <Check size={16} /> Save Voice Memo
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={onCancel} disabled={phase === 'recording'}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
