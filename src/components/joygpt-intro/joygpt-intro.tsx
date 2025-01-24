import { Component, EventEmitter, State, h, Event } from '@stencil/core';

@Component({
	tag: 'joygpt-intro',
	styleUrl: 'joygpt-intro.css',
	shadow: true,
	assetsDirs: ['assets']
})
export class JoyGPTIntro {
	// States
	@State() promptText = '';
	@State() isListening: boolean = false;

	// Events
	@Event() promptEvent: EventEmitter<string>;

	// Variables
	recognition: SpeechRecognition | null = null;
	showMicToggle: boolean = true;

	handleInputChange(event: any) {
		this.promptText = event.target.value;
	}

	handleKeyPress(event: any) {
		if (event.key === 'Enter') {
			this.promptEvent.emit(this.promptText);
			this.promptText = '';
		}
	}

	toggleListening() {
		if (this.isListening) {
			this.stopListening();
		} else {
			this.startListening();
		}
	}

	startListening() {
		const SpeechRecognitionAPI =
			(window as unknown as Window & { webkitSpeechRecognition?: any; SpeechRecognition?: any }).SpeechRecognition ||
			(window as unknown as Window & { webkitSpeechRecognition?: any; SpeechRecognition?: any }).webkitSpeechRecognition;

		if (!SpeechRecognitionAPI) {
			alert('Speech recognition not supported in this browser.');
			return;
		}

		this.recognition = new SpeechRecognitionAPI();
		this.recognition.continuous = false;
		this.recognition.interimResults = true;
		this.recognition.lang = 'en-US';

		this.recognition.onstart = () => {
			this.isListening = true;
		};

		this.recognition.onresult = (event: SpeechRecognitionEvent) => {
			let transcript = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				transcript += event.results[i][0].transcript;
			}
			this.promptText = transcript;
		};

		this.recognition.onerror = (event) => {
			console.error('Speech recognition error:', event.error);
			this.isListening = false;
		};

		this.recognition.onend = () => {
			this.isListening = false;
		};

		this.recognition.start();
	}

	stopListening() {
		if (this.recognition) {
			this.recognition.stop();
			this.isListening = false;
		}
	}

	render() {
		return (
			<div class="prompt-input-wrapper">
				<div class="prompt-input">
					<input
						class="input input-alt"
						placeholder="Message JoyGPT"
						required={true}
						type="text"
						value={this.promptText}
						onInput={e => this.handleInputChange(e)}
						onKeyPress={e => this.handleKeyPress(e)}
					></input>
					<span class="input-border input-border-alt"></span>
				</div>

				{this.showMicToggle && (
					<div class="mic-input">
						<input
							type="checkbox"
							id="checkbox"
							on-click={() => this.toggleListening()}
						></input>
						<label class="switch" htmlFor="checkbox">
							{this.isListening ? (
								<div class="mic-on">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-mic-fill" viewBox="0 0 16 16">
										<path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"></path>
										<path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"></path>
									</svg>
								</div>
							) : (
								<div class="mic-off">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-mic-mute-fill" viewBox="0 0 16 16">
										<path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879L5.158 2.037A3.001 3.001 0 0 1 11 3z"></path>
										<path d="M9.486 10.607 5 6.12V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z"></path>
									</svg>
								</div>
							)}
						</label>
					</div>
				)}

			</div>
		);
	}
}



