import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

// Utility to generate temporary IDs for optimistic turns
function generateTempId() {
  return 'temp-' + Math.random().toString(36).slice(2);
}

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
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState<{ id: string; persona: string; model: string; messageCount: number }[]>([]);
  // Track which agents are active in the conversation
  const [activeAgentIds, setActiveAgentIds] = useState<string[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPersona, setNewAgentPersona] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [message, setMessage] = useState('');
  // Dialog turn type with id and status
  type DialogTurn = { id: string; speaker: string; message: string; status?: 'pending' | 'confirmed'; timestamp?: number };
  const [dialog, setDialog] = useState<DialogTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const streamingMessageRef = React.useRef("");
  const [autoScroll, setAutoScroll] = useState(true);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Sync participant selection with backend whenever activeAgentIds changes
  React.useEffect(() => {
    if (activeAgentIds.length === 0) return;
    fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds: activeAgentIds })
    }).catch(err => {
      // Optionally handle error
      console.error('Error updating participants:', err);
    });
  }, [activeAgentIds]);

  // Fetch agent list from backend on mount
  React.useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
          // If no agentId or current agentId is not in list, set to first agent
          if (!agentId || !data.agents.some((a: any) => a.id === agentId)) {
            if (data.agents.length > 0) setAgentId(data.agents[0].id);
          }
          // Default: all agents active
          setActiveAgentIds(data.agents.map((a: any) => a.id));
        }
      } catch (err) {
        // Optionally handle error
      }
    };
    fetchAgents();
  }, []);

  // Poll /api/dialog every 1 second for real-time updates
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dialog');
        const data = await res.json();
        if (Array.isArray(data.dialog)) {
          setDialog((localDialog) => {
            // Map backend turns by ID
            const backendTurns: Record<string, DialogTurn> = {};
            data.dialog.forEach((turn: any) => {
              backendTurns[turn.id] = { ...turn, status: 'confirmed' };
            });
            // Replace temp agent turn (pending, same agent, empty or streaming message) with confirmed backend agent turn
            let merged: DialogTurn[] = [...localDialog];
            Object.values(backendTurns).forEach(turn => {
              if (turn.status === 'confirmed' && turn.speaker !== 'user' && turn.speaker !== 'System') {
                // Find first pending temp agent turn for same agent (message is empty or pending)
                const idx = merged.findIndex(t => t.status === 'pending' && t.speaker === turn.speaker && (t.message === '' || t.message === streamingMessageRef.current));
                if (idx !== -1) {
                  merged[idx] = turn;
                  return;
                }
              }
              // For user turns or unmatched agent turns, match by speaker/message as before
              const idx2 = merged.findIndex(t => t.status === 'pending' && t.speaker === turn.speaker && t.message === turn.message);
              if (idx2 !== -1) {
                merged[idx2] = turn;
              } else if (!merged.some(t => t.id === turn.id)) {
                merged.push(turn);
              }
            });
            // Remove any remaining temp agent turns that have been replaced
            merged = merged.filter(t => {
              if (t.status === 'pending' && t.speaker !== 'user' && t.speaker !== 'System') {
                // If a confirmed turn for same agent exists, remove temp
                return !Object.values(backendTurns).some(bt => bt.speaker === t.speaker && bt.status === 'confirmed');
              }
              return true;
            });
            // Remove duplicate turns (keep only one per speaker/message pair, prefer confirmed)
            const seen = new Set<string>();
            merged = merged.filter(t => {
              const key = t.speaker + '|' + t.message;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            // Sort by timestamp if available, fallback to order
            merged.sort((a, b) => {
              if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
              return 0;
            });
            return merged;
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
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    await setUserTyping(false);
    // Optimistically add user message and agent turns for all active agents
    setDialog((d) => [
      ...d,
      { id: generateTempId(), speaker: 'user', message, status: 'pending' },
  ...activeAgentIds.map(aid => ({ id: generateTempId(), speaker: aid, message: '', status: 'pending' as 'pending' }))
    ]);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, participantIds: activeAgentIds })
      });
      setMessage('');
      // Optionally, start streaming for each agent (if supported)
      // For now, just stream for the first agent
      if (activeAgentIds.length > 0) {
        const eventSource = new EventSource(`/api/agent-stream/${activeAgentIds[0]}`);
        eventSource.onmessage = (event) => {
          if (event.data === '[DONE]') {
            if (streamingMessageRef.current.length > 0) {
              setDialog((d) => {
                const idx = d.findIndex((turn, i) => turn.speaker === activeAgentIds[0] && i === d.length - 1);
                if (idx !== -1) {
                  const updated = [...d];
                  updated[idx] = { ...updated[idx], message: streamingMessageRef.current };
                  return updated;
                }
                return d;
              });
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
                setDialog((d) => {
                  const idx = d.findIndex((turn, i) => turn.speaker === activeAgentIds[0] && i === d.length - 1);
                  if (idx !== -1) {
                    const updated = [...d];
                    updated[idx] = { ...updated[idx], message: streamingMessageRef.current };
                    return updated;
                  }
                  return d;
                });
              }
              if (data.error) {
                setDialog((d) => [
                  ...d,
                  { id: generateTempId(), speaker: 'System', message: `Error: ${data.error}`, status: 'confirmed', timestamp: Date.now() }
                ]);
                streamingMessageRef.current = "";
                setStreamingMessage("");
                eventSource.close();
                setLoading(false);
              }
            } catch (err) {
              setDialog((d) => [
                ...d,
                { id: generateTempId(), speaker: 'System', message: 'Streaming error: invalid data.', status: 'confirmed', timestamp: Date.now() }
              ]);
              streamingMessageRef.current = "";
              setStreamingMessage("");
              eventSource.close();
              setLoading(false);
            }
          }
        };
        eventSource.onerror = () => {
          setDialog((d) => [
            ...d,
            { id: generateTempId(), speaker: 'System', message: 'Streaming error: connection lost.', status: 'confirmed', timestamp: Date.now() }
          ]);
          streamingMessageRef.current = "";
          setStreamingMessage("");
          eventSource.close();
          setLoading(false);
        };
      }
    } catch (err) {
      setDialog((d) => [
        ...d,
        { id: generateTempId(), speaker: 'System', message: 'Error sending message.', status: 'confirmed', timestamp: Date.now() }
      ]);
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
      {/* Agent participant selection */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 'bold', marginRight: 8 }}>Conversation Participants:</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {agents.map(agent => (
            <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: activeAgentIds.includes(agent.id) ? '#e3f2fd' : '#f9f9f9', borderRadius: 4, padding: '2px 8px' }}>
              <input
                type="checkbox"
                checked={activeAgentIds.includes(agent.id)}
                onChange={e => {
                  setActiveAgentIds(ids => e.target.checked ? [...ids, agent.id] : ids.filter(id => id !== agent.id));
                }}
              />
              <span style={{ fontWeight: 'bold' }}>{agent.id}</span>
              <span style={{ color: '#888', fontSize: '0.9em' }}>({agent.persona.slice(0, 18)}{agent.persona.length > 18 ? '...' : ''})</span>
            </label>
          ))}
        </div>
      </div>
      {/* Active agents feedback */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 'bold', color: '#1976d2' }}>Active agents:</span>
        {activeAgentIds.length === 0 ? (
          <span style={{ color: '#b71c1c', marginLeft: 8 }}>None selected</span>
        ) : (
          <span style={{ marginLeft: 8 }}>{activeAgentIds.map(id => <span key={id} style={{ marginRight: 8 }}>{id}</span>)}</span>
        )}
      </div>

        {/* Agent creation form */}
        <form
          onSubmit={async e => {
            e.preventDefault();
            setAgentError('');
            if (!newAgentName.trim() || !newAgentPersona.trim()) {
              setAgentError('Name and persona are required.');
              return;
            }
            setCreatingAgent(true);
            try {
              const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newAgentName.trim(), persona: newAgentPersona.trim() })
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                setAgentError(data.error || 'Failed to create agent.');
              } else {
                setNewAgentName('');
                setNewAgentPersona('');
                // Refresh agent list
                const agentRes = await fetch('/api/agents');
                const agentData = await agentRes.json();
                if (Array.isArray(agentData.agents)) {
                  setAgents(agentData.agents);
                  setAgentId(data.agent.id);
                }
              }
            } catch (err) {
              setAgentError('Failed to create agent.');
            }
            setCreatingAgent(false);
          }}
          style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <input
            type="text"
            value={newAgentName}
            onChange={e => setNewAgentName(e.target.value)}
            placeholder="Agent name"
            style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            disabled={creatingAgent}
          />
          <input
            type="text"
            value={newAgentPersona}
            onChange={e => setNewAgentPersona(e.target.value)}
            placeholder="Agent persona/description"
            style={{ flex: 2, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            disabled={creatingAgent}
          />
          <button
            type="submit"
            disabled={creatingAgent}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#388e3c', color: '#fff', cursor: 'pointer' }}
          >
            {creatingAgent ? 'Creating...' : 'Add Agent'}
          </button>
        </form>

      {/* Agent creation form */}
      {agentError && (
        <div style={{ color: '#b71c1c', marginBottom: 8 }}>{agentError}</div>
      )}
      {/* Error alert if any System message in dialog */}
      {dialog.some(turn => turn.speaker === 'System') && (
        <div style={{ background: '#ffe0e0', color: '#b71c1c', padding: '8px 12px', borderRadius: 4, marginBottom: 12, fontWeight: 'bold' }}>
          {dialog.filter(turn => turn.speaker === 'System').map((turn, i) => <div key={i}>{turn.message}</div>)}
        </div>
      )}
      <div ref={chatWindowRef} style={{ minHeight: 120, maxHeight: 320, overflowY: 'auto', marginBottom: 16, background: '#f9f9f9', borderRadius: 4, padding: 12, fontSize: '1rem', transition: 'background 0.2s' }}>
        {dialog.length === 0 ? (
          <div style={{ color: '#888' }}>No messages yet.</div>
        ) : (
          <>
            {dialog.map((turn, i) => (
              <div key={turn.id} style={{ marginBottom: 8, opacity: turn.status === 'pending' ? 0.6 : 1 }}>
                <b>{turn.speaker}:</b>{' '}
                {turn.speaker.startsWith('agent') ? (
                  <>
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
                    {/* Blinking cursor for streaming agent turn */}
                    {loading && i === dialog.length - 1 && (
                      <span style={{
                        display: 'inline-block',
                        width: '1ch',
                        animation: 'blink 1s steps(1) infinite',
                        color: '#1976d2',
                        fontWeight: 'bold'
                      }}>|</span>
                    )}
                    {/* Pending indicator for temp turns */}
                    {turn.status === 'pending' && (
                      <span style={{ color: '#888', marginLeft: 8 }}>(pending)</span>
                    )}
                  </>
                ) : (
                  turn.message
                )}
              </div>
            ))}
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
