import { OllamaAgent } from './ollamaAgent';
import { DialogManager } from './dialogManager';
import express from 'express';
import path from 'path';
import logger from './logger';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// Store agents by ID (in-memory for now)
const agents: Record<string, OllamaAgent> = {
	"Rambler": new OllamaAgent({ persona: "You are a traveler. You have seen distant lands and have a wealth of stories to share. You are humble." })
	// Add more agents here as needed
};
const dialogManager = new DialogManager(Object.keys(agents));
let agentLoopActive = false;
let lastSpeaker: string | null = null;
let agentResponseInProgress = false;

// Background agent dialog loop (N agents)
let agentInterval = setInterval(async () => {
	if (!agentLoopActive || agentResponseInProgress) return;
	if (dialogManager.getUserTyping()) {
		agentLoopActive = false;
		logger.info('[agentLoop] Pausing agent loop due to user typing', { userTyping: dialogManager.getUserTyping() });
		return;
	}
	const dialog = dialogManager.getDialog();
	if (dialog.length === 0) return;
	const currentLastSpeaker = dialogManager.getLastSpeaker();
	const nextAgentId = dialogManager.getNextAgent();
	if (!nextAgentId || !agents[nextAgentId]) return;
	// Only respond if last speaker is not the next agent
	if (currentLastSpeaker === nextAgentId) return;

	agentResponseInProgress = true;
	logger.info(`[agentLoop] ${nextAgentId} responding (userTyping=${dialogManager.getUserTyping()})`, { dialog: dialog.slice(-6) });
	try {
		// Check before generating response
		if (dialogManager.getUserTyping()) {
			logger.info(`[agentLoop] Agent ${nextAgentId} skipped due to user typing`, { userTyping: dialogManager.getUserTyping() });
			agentResponseInProgress = false;
			return;
		}
		// Use AbortController to interrupt agent response if userTyping becomes true
		const abortController = new AbortController();
		let response: string | undefined;
		let done = false;
		const poll = setInterval(() => {
			if (dialogManager.getUserTyping() && !done) {
				abortController.abort();
				logger.info(`[agentLoop] Agent ${nextAgentId} response aborted due to user typing`, { userTyping: dialogManager.getUserTyping() });
			}
		}, 100);
		try {
			response = await agents[nextAgentId].getCompletion(dialog, abortController.signal);
			done = true;
		} catch (err) {
			if (abortController.signal.aborted) {
				agentResponseInProgress = false;
				clearInterval(poll);
				return;
			}
			throw err;
		}
		clearInterval(poll);
		// Check again after response in case user started typing during await
		if (dialogManager.getUserTyping()) {
			logger.info(`[agentLoop] Agent ${nextAgentId} response discarded due to user typing`, { userTyping: dialogManager.getUserTyping() });
			agentResponseInProgress = false;
			return;
		}
		logger.info(`[agentLoop] Agent ${nextAgentId} response accepted`, { response });
		dialogManager.addTurn(nextAgentId, response);
		dialogManager.setLastSpeaker(nextAgentId);
	} catch (agentErr) {
		logger.error(`[agentLoop] Error from ${nextAgentId}`, { error: agentErr });
		dialogManager.addTurn(nextAgentId, `Error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`);
		dialogManager.setLastSpeaker(nextAgentId);
	}
	agentResponseInProgress = false;
	return;
}, 1000);


// Set user typing state
app.post('/api/user-typing', (req, res) => {
	logger.info('[api/user-typing] Received request', { body: req.body });
	const { typing } = req.body;
	dialogManager.setUserTyping(Boolean(typing));
	logger.info(`[userTyping] Set to ${dialogManager.getUserTyping()} by /api/user-typing`, { typing });
	// If userTyping is now false (user cleared box), restart agent loop if last speaker is user
	if (!Boolean(typing)) {
		const dialog = dialogManager.getDialog();
		const lastTurn = dialog.length > 0 ? dialog[dialog.length - 1] : null;
		if (lastTurn) {
			agentLoopActive = true;
			logger.info('[userTyping] Restarting agent loop after user cleared text box', { lastUserMessage: lastTurn.message });
		}
	}
	res.json({ success: true, userTyping: dialogManager.getUserTyping() });
});

// Streaming agent response via SSE
app.get('/api/agent-stream/:agentId', async (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		res.status(400).json({ error: 'Invalid agentId' });
		return;
	}
	// Set SSE headers
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders?.();

	const dialogSlice = dialogManager.getDialog().slice(-24);
	try {
		const stream = await agents[agentId].getCompletionStream(dialogSlice);
		const reader = stream.getReader();
		let done = false;
		while (!done) {
			const { value, done: streamDone } = await reader.read();
			if (streamDone) break;
			res.write(`data: ${JSON.stringify({ token: value })}\n\n`);
		}
		res.write('data: [DONE]\n\n');
		res.end();
	} catch (err) {
		logger.error(`[SSE] Streaming error for agent ${agentId}:`, { error: err });
		res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n\n`);
		res.write('data: [DONE]\n\n');
		res.end();
	}
});

// Create a new agent
app.post('/api/agents', (req, res) => {
	const { name, persona, model } = req.body;
	if (!name || typeof name !== 'string' || !persona || typeof persona !== 'string') {
		return res.status(400).json({ error: 'Agent name and persona are required.' });
	}
	if (agents[name]) {
		return res.status(400).json({ error: 'Agent with this name already exists.' });
	}
	const newAgent = new OllamaAgent({ persona, model });
	agents[name] = newAgent;
	dialogManager.addAgent(name);
	res.json({ success: true, agent: { id: name, persona, model: model || newAgent.getModel() } });
});

// List available agents and their status
app.get('/api/agents', (req, res) => {
	const agentList = Object.entries(agents).map(([id, agent]) => ({
		id,
		model: (agent as any).model,
		persona: (agent as any).persona,
		messageCount: (agent as any).messages.length
	}));
	res.json({ agents: agentList });
});

// Reset an agent's dialog history
app.post('/api/agents/:agentId/reset', (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		return res.status(400).json({ error: 'Invalid or missing agentId.' });
	}
	agents[agentId].resetMessages();
	res.json({ success: true });
});

// API endpoint for chat with a specific agent
app.post('/api/chat', async (req, res) => {
	console.log('Request body:', req.body);
	try {
		const { message, agentId } = req.body;
		if (!message || typeof message !== 'string') {
			logger.error('Invalid message received', { body: req.body });
			return res.status(400).json({ error: 'Message is required.' });
		}
		if (!agentId || !agents[agentId]) {
			logger.error('Invalid agentId received', { body: req.body });
			return res.status(400).json({ error: 'agentId is required and must be valid.' });
		}
		logger.info('User message received', { message, agentId });
		// Set selected agent for next response
		dialogManager.setSelectedAgent(agentId);
		dialogManager.addTurn('user', message);
		dialogManager.setLastSpeaker('user');
		agentLoopActive = true;
		res.json({ dialog: dialogManager.getDialog().slice(-24) });
	} catch (err) {
		logger.error('Error in /api/chat', { error: err });
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}

	// Background agent dialog loop

	// Remove legacy agent1/agent2 alternation logic
	// The agent loop above (lines 18-81) already supports dynamic agents using dialogManager.getNextAgent()
});

// Redirect root to /chat for user convenience
app.get('/', (req, res) => {
	res.redirect('/chat');
});


// Serve React build at /chat and static assets only in production
if (process.env.NODE_ENV === 'production') {
	const reactBuildPath = path.join(__dirname, '../../client/build');
	app.use('/chat', express.static(reactBuildPath));
	app.get('/chat', (req, res) => {
		res.sendFile(path.join(reactBuildPath, 'index.html'));
	});
}

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});

// Return current dialog for real-time UI polling
app.get('/api/dialog', (req, res) => {
	res.json({ dialog: dialogManager.getDialog().slice(-24) }); // Return last 24 turns for more context
});

app.delete('/api/agents/:agentId', (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		return res.status(400).json({ error: 'Invalid or missing agentId.' });
	}
	delete agents[agentId];
	dialogManager.agents = dialogManager.agents.filter(id => id !== agentId);
	res.json({ success: true });
});

app.post('/api/dialog/reset', (req, res) => {
	dialogManager.resetDialog();
	res.json({ success: true });
});

app.get('/api/agents/:agentId', (req, res) => {
	const { agentId } = req.params;
	const agent = agents[agentId];
	if (!agent) {
		return res.status(404).json({ error: 'Agent not found.' });
	}
	res.json({
		id: agentId,
		model: agent.getModel(),
		persona: agent.getPersona ? agent.getPersona() : undefined,
		messageCount: agent.getMessages ? agent.getMessages().length : undefined
	});
});