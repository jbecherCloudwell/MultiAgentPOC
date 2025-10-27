import { DialogTurn } from "./manager";

export class Agent {
	getCompletion(dialog: DialogTurn[]) {
		throw new Error('Method not implemented.');
	}
	private name: string;

	constructor(name: string) {
		this.name = name;
	}

	async respond(input: string, dialog: DialogTurn[]): Promise<string> {
		// Example: reference the last agent message for context
		const lastAgent = dialog.filter(d => d.speaker !== 'user').slice(-1)[0]?.message || '';
		const lastTurn = dialog[dialog.length - 1];
		if (lastTurn && lastTurn.speaker !== 'user' && lastTurn.speaker !== this.name) {
			// The last message was from another agent
			return `(${this.name}): Received message from ${lastTurn.speaker}: "${lastTurn.message}". Responding as requested.`;
		}
		// Otherwise, respond to user
		return `(${this.name}): I received: "${input}". Dialog so far: ${dialog.length} turns.`;
	}
}