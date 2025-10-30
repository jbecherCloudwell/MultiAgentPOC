import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const MultiAgentChat: React.FC = () => {
  // Helper to set userTyping state in backend
  const setUserTyping = async (typing: boolean) => {
    try {
      await fetch('/api/user-typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing })
      });
    } catch (err) {
      console.error('Error setting user typing:', err);
    }
  };
  const chatWindowRef = React.useRef<HTMLDivElement>(null);
  const [agentId, setAgentId] = useState('agent1');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<{ speaker: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const streamingMessageRef = React.useRef("");
  const [autoScroll, setAutoScroll] = useState(true);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Poll /api/dialog every 1 second for real-time updates
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dialog');
        const data = await res.json();
        if (Array.isArray(data.dialog)) {
          setDialog((localDialog) => {
            // Remove duplicate user messages (optimistic UI)
            const backendUserMessages = data.dialog.filter((turn: { speaker: string; message: string }) => turn.speaker === 'user').map((turn: { speaker: string; message: string }) => turn.message);
            const filteredLocal = localDialog.filter((turn: { speaker: string; message: string }) => turn.speaker !== 'user' || !backendUserMessages.includes(turn.message));
            // Merge backend dialog (authoritative) with filtered local dialog
            return [...data.dialog, ...filteredLocal.filter((turn: { speaker: string; message: string }) => turn.speaker === 'user')];
          });
        }
      } catch (err) {
        // Optionally handle polling errors
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track user scroll position to enable/disable auto-scroll
  React.useEffect(() => {
    const ref = chatWindowRef.current;
    if (!ref) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = ref;
      // If user is within 40px of the bottom, enable auto-scroll
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };
    ref.addEventListener('scroll', handleScroll);
    return () => ref.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom only if user is near the bottom
  React.useEffect(() => {
    if (autoScroll && chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [dialog, streamingMessage, autoScroll]);

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setStreamingMessage("");
    streamingMessageRef.current = "";
    // Immediately set userTyping to false and clear debounce
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    await setUserTyping(false); // User finished typing
    // Optimistically add user message to local dialog
    setDialog((d) => [...d, { speaker: 'user', message }]);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message })
      });
      setMessage('');
      // Start streaming agent response
      const eventSource = new EventSource(`/api/agent-stream/${agentId}`);
      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          // Append final agent response to dialog
          if (streamingMessageRef.current.length > 0) {
            setDialog((d) => [...d, { speaker: agentId, message: streamingMessageRef.current }]);
          }
          streamingMessageRef.current = "";
          setStreamingMessage("");
          eventSource.close();
          setLoading(false);
        } else {
          try {
            const data = JSON.parse(event.data);
            if (data.token) {
              streamingMessageRef.current += data.token;
              setStreamingMessage(streamingMessageRef.current);
            }
            if (data.error) {
              setDialog((d) => [...d, { speaker: 'System', message: `Error: ${data.error}` }]);
              streamingMessageRef.current = "";
              setStreamingMessage("");
              eventSource.close();
              setLoading(false);
            }
          } catch (err) {
            setDialog((d) => [...d, { speaker: 'System', message: 'Streaming error: invalid data.' }]);
            streamingMessageRef.current = "";
            setStreamingMessage("");
            eventSource.close();
            setLoading(false);
          }
        }
      };
      eventSource.onerror = () => {
        setDialog((d) => [...d, { speaker: 'System', message: 'Streaming error: connection lost.' }]);
        streamingMessageRef.current = "";
        setStreamingMessage("");
        eventSource.close();
        setLoading(false);
      };
    } catch (err) {
      setDialog((d) => [...d, { speaker: 'System', message: 'Error sending message.' }]);
      setLoading(false);
    }
  };

  // Optimized: only call setUserTyping when transitioning between empty/non-empty
  const prevMessageLength = React.useRef(0);
  const typingDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);
    // Debounce userTyping=true if input is non-empty
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    if (newValue.length > 0) {
      typingDebounceRef.current = setTimeout(() => {
        setUserTyping(true);
      }, 300);
    } else {
      setUserTyping(false);
    }
    prevMessageLength.current = newValue.length;
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 24 }}>
      <h2>MultiAgentPOC Chat</h2>
      {/* Error alert if any System message in dialog */}
      {dialog.some(turn => turn.speaker === 'System') && (
        <div style={{ background: '#ffe0e0', color: '#b71c1c', padding: '8px 12px', borderRadius: 4, marginBottom: 12, fontWeight: 'bold' }}>
          {dialog.filter(turn => turn.speaker === 'System').map((turn, i) => <div key={i}>{turn.message}</div>)}
        </div>
      )}
      <div ref={chatWindowRef} style={{ minHeight: 120, maxHeight: 320, overflowY: 'auto', marginBottom: 16, background: '#f9f9f9', borderRadius: 4, padding: 12, fontSize: '1rem', transition: 'background 0.2s' }}>
        {dialog.length === 0 && streamingMessage.length === 0 ? (
          <div style={{ color: '#888' }}>No messages yet.</div>
        ) : (
          <>
            {dialog.map((turn, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <b>{turn.speaker}:</b>{' '}
                {turn.speaker.startsWith('agent') ? (
                  <ReactMarkdown
                    children={turn.message}
                    components={{
                      p: ({ children }: { children: React.ReactNode }) => <p style={{ margin: '4px 0' }}>{children}</p>,
                      strong: ({ children }: { children: React.ReactNode }) => <strong style={{ color: '#1976d2' }}>{children}</strong>,
                      em: ({ children }: { children: React.ReactNode }) => <em style={{ color: '#d2691e' }}>{children}</em>,
                      ul: ({ children }: { children: React.ReactNode }) => <ul style={{ marginLeft: 20 }}>{children}</ul>,
                      ol: ({ children }: { children: React.ReactNode }) => <ol style={{ marginLeft: 20 }}>{children}</ol>,
                      li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                      h1: ({ children }: { children: React.ReactNode }) => <h3 style={{ color: '#1976d2', margin: '8px 0' }}>{children}</h3>,
                      h2: ({ children }: { children: React.ReactNode }) => <h4 style={{ color: '#1976d2', margin: '6px 0' }}>{children}</h4>,
                      h3: ({ children }: { children: React.ReactNode }) => <h5 style={{ color: '#1976d2', margin: '4px 0' }}>{children}</h5>,
                    }}
                  />
                ) : (
                  turn.message
                )}
              </div>
            ))}
            {streamingMessage.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <b>{agentId}:</b>{' '}
                <ReactMarkdown
                  children={streamingMessage}
                  components={{
                    p: ({ children }: { children: React.ReactNode }) => <p style={{ margin: '4px 0', color: '#1976d2' }}>{children}</p>,
                    strong: ({ children }: { children: React.ReactNode }) => <strong style={{ color: '#1976d2' }}>{children}</strong>,
                    em: ({ children }: { children: React.ReactNode }) => <em style={{ color: '#d2691e' }}>{children}</em>,
                    ul: ({ children }: { children: React.ReactNode }) => <ul style={{ marginLeft: 20 }}>{children}</ul>,
                    ol: ({ children }: { children: React.ReactNode }) => <ol style={{ marginLeft: 20 }}>{children}</ol>,
                    li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                    h1: ({ children }: { children: React.ReactNode }) => <h3 style={{ color: '#1976d2', margin: '8px 0' }}>{children}</h3>,
                    h2: ({ children }: { children: React.ReactNode }) => <h4 style={{ color: '#1976d2', margin: '6px 0' }}>{children}</h4>,
                    h3: ({ children }: { children: React.ReactNode }) => <h5 style={{ color: '#1976d2', margin: '4px 0' }}>{children}</h5>,
                  }}
                />
                <span style={{
                  display: 'inline-block',
                  width: '1ch',
                  animation: 'blink 1s steps(1) infinite',
                  color: '#1976d2',
                  fontWeight: 'bold'
                }}>|</span>
              </div>
            )}
            {/* Blinking cursor animation */}
            <style>{`
              @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0; }
                100% { opacity: 1; }
              }
            `}</style>
          </>
        )}
      </div>
      {/* Loading spinner when waiting for agent response */}
      {loading && (
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <span style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #1976d2', borderRadius: '50%', borderTop: '3px solid #fff', animation: 'spin 1s linear infinite' }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={message} onChange={handleInputChange} placeholder="Type your message..." required autoComplete="off" style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#1976d2', color: '#fff', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
};

export default MultiAgentChat;
