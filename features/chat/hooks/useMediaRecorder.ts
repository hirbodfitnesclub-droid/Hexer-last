import { useCallback, useEffect, useRef, useState } from 'react';
import {
  baseMimeType,
  describeMediaError,
  MAX_RECORDING_MS,
  selectMimeType,
  validateRecording,
  type RecorderError,
} from './recorderConstraints';

export const useMediaRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const limitRef = useRef<number | null>(null);
  const discardRef = useRef(false);

  /**
   * Releases the microphone. Called from every exit path — stop, cancel, error, and
   * unmount — because the browser keeps the recording indicator lit until the tracks
   * themselves are stopped.
   */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (limitRef.current !== null) {
      window.clearTimeout(limitRef.current);
      limitRef.current = null;
    }
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = selectMimeType(
        typeof MediaRecorder !== 'undefined' ? MediaRecorder.isTypeSupported : undefined
      );
      // Passing an unsupported mimeType throws on Safari, so omit the option entirely
      // when nothing in our preference list is supported.
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      discardRef.current = false;
      startedAtRef.current = Date.now();
      setElapsedMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        discardRef.current = true;
        setError({ code: 'recorder_error', message: 'ضبط صدا با خطا متوقف شد.' });
        setIsRecording(false);
        releaseStream();
      };

      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        releaseStream();
        if (discardRef.current) {
          audioChunksRef.current = [];
          return;
        }
        const type = baseMimeType(recorder.mimeType || mimeType);
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        const invalid = validateRecording({ size: blob.size, durationMs });
        if (invalid) {
          setError(invalid);
          setRecordedAudio(null);
          return;
        }
        setRecordedAudio(blob);
      };

      recorder.start();
      setIsRecording(true);

      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);

      // Hard stop at the cap so a forgotten recording cannot grow without bound.
      limitRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, MAX_RECORDING_MS);
    } catch (mediaError) {
      releaseStream();
      setIsRecording(false);
      setError(describeMediaError(mediaError));
    }
  }, [releaseStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    releaseStream();
    setRecordedAudio(null);
    setIsRecording(false);
    setElapsedMs(0);
    audioChunksRef.current = [];
  }, [releaseStream]);

  const handleMicClick = useCallback(() => {
    if (isRecording) stopRecording();
    else void startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    recordedAudio,
    setRecordedAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    handleMicClick,
    error,
    elapsedMs,
  };
};
