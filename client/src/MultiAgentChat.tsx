import React, { useState } from 'react';

const agents = [
  { id: 'agent1', label: 'Agent 1' },
  { id: 'agent2', label: 'Agent 2' }
];

const MultiAgentChat: React.FC = () => {
  const chatWindowRef = React.useRef<HTMLDivElement>(null);
  const [agentId, setAgentId] = useState('agent1');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<{ speaker: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const streamingMessageRef = React.useRef("");

  // Poll /api/dialog every 1 second for real-time updates
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dialog');
        const data = await res.json();
        if (Array.isArray(data.dialog)) {
          setDialog(data.dialog);
        }
      } catch (err) {
        // Optionally handle polling errors
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when dialog or streamingMessage changes
  React.useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [dialog, streamingMessage]);

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
  setLoading(true);
  // If a previous stream is active, reset it
  setStreamingMessage("");
  streamingMessageRef.current = "";
  // Optionally, close any previous EventSource (not tracked here, but could be with a ref)
    try {
      // Send user message to backend
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
          setDialog((d) => [...d, { speaker: agentId, message: streamingMessageRef.current }]);
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

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 24 }}>
      <h2>MultiAgentPOC Chat</h2>
  <div ref={chatWindowRef} style={{ minHeight: 120, maxHeight: 320, overflowY: 'auto', marginBottom: 16, background: '#f9f9f9', borderRadius: 4, padding: 12, fontSize: '1rem', transition: 'background 0.2s' }}>
        {dialog.length === 0 && streamingMessage.length === 0 ? (
          <div style={{ color: '#888' }}>No messages yet.</div>
        ) : (
          <>
            {dialog.map((turn, i) => (
              <div key={i} style={{ marginBottom: 8 }}><b>{turn.speaker}:</b> {turn.message}</div>
            ))}
            {streamingMessage.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <b>{agentId}:</b>
                <span style={{ color: '#1976d2' }}>{streamingMessage}</span>
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
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <select value={agentId} onChange={e => setAgentId(e.target.value)} style={{ padding: 8, borderRadius: 4 }}>
          {agents.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." required autoComplete="off" style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#1976d2', color: '#fff', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
};

export default MultiAgentChat;
