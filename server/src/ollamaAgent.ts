// Using native Node.js fetch (Node 18+)
import type { ChatCompletion } from 'openai/resources';

export interface AgentMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface AgentOptions {
	model?: string;
	endpoint?: string;
	persona?: string;
}

export class OllamaAgent {
	private model: string;
	private endpoint: string;
	private persona: string;
	private messages: AgentMessage[];

	constructor(options: AgentOptions = {}) {
		this.model = options.model || process.env.OLLAMA_MODEL || 'llama3.2'; // or phi or gemma. support for mistral and llama2 may come later
		this.endpoint = options.endpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/v1';
		this.persona = options.persona || 'You are a helpful assistant.';
		this.messages = [{ role: 'system', content: this.persona }];
	}

	addUserMessage(content: string) {
		this.messages.push({ role: 'user', content });
	}

	addAssistantMessage(content: string) {
		this.messages.push({ role: 'assistant', content });
	}

	async getCompletion(dialog: { speaker: string; message: string }[], abortSignal?: AbortSignal): Promise<string> {
		// Build prompt from dialog history
		const prompt = dialog.map(turn => `${turn.speaker}: ${turn.message}`).join('\n');
		const body = {
			model: this.model,
			messages: [
				{ role: 'system', content: this.persona },
				{ role: 'user', content: prompt }
			],
			temperature: 0.7,
			max_tokens: 400,
			top_p: 0.95,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: false
		};
		const res = await fetch(`${this.endpoint}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: abortSignal
		});
		if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
		const data = await res.json();
		return data.choices?.[0]?.message?.content || '';
	}

	// Streaming version: returns a ReadableStream of tokens/messages
	async getCompletionStream(dialog: { speaker: string; message: string }[], abortSignal?: AbortSignal): Promise<ReadableStream<string>> {
		// Use /api/generate for true incremental streaming
		const prompt = dialog.map(turn => `${turn.speaker}: ${turn.message}`).join('\n');
		const body = {
			model: this.model,
			prompt: `${this.persona}\n${prompt}`,
			stream: true
		};
		const res = await fetch(`${this.endpoint.replace(/\/v1$/, '')}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: abortSignal
		});
		if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
		const stream = res.body;
		if (!stream) throw new Error('No response stream');
		const decoder = new TextDecoder();
		const readable = new ReadableStream<string>({
			async start(controller) {
				const reader = stream.getReader();
				let buffer = '';
				while (true) {
					if (abortSignal?.aborted) {
						controller.close();
						return;
					}
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					// Split by newlines
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const obj = JSON.parse(line);
							if (obj.done) {
								controller.close();
								return;
							}
							if (obj.response) {
								controller.enqueue(obj.response);
							}
						} catch (err) {
							// Ignore parse errors
						}
					}
				}
				controller.close();
			}
		});
		return readable;
	}


	getModel() {
		return this.model;
	}

	setModel(model: string) {
		this.model = model;
	}

	setPersona(persona: string) {
		this.persona = persona;
		this.messages[0] = { role: 'system', content: persona };
	}

	resetMessages() {
		this.messages = [{ role: 'system', content: this.persona }];
	}

	getPersona() {
		return this.persona;
	}
	getMessages() {
		return this.messages;
	}
}
