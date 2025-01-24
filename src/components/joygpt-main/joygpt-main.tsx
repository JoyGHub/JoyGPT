
import { Component, h, State, Element, Listen, Method } from '@stencil/core';
import { marked, Renderer } from 'marked';

@Component({
  tag: 'joygpt-main',
  styleUrl: 'joygpt-main.css',
  shadow: true
})
export class JoyGPTMain {
  @Element() el: HTMLElement;

  // States
  @State() chatHistory = [];
  @State() controller = null;
  @State() promptText = '';
  @State() renderer = new Renderer();
  @State() marked = marked;
  @State() models: any[] = [];
  @State() ollamaRunning: boolean;
  @State() modelDownloadVisible: boolean;
  @State() isLoading = false;
  @State() modelName: string = '';
  @State() progress: number = 0;
  @State() statusMessage: string = '';
  @State() isInstalling: boolean = false;
  @State() installedModels: any[] = [];
  @State() modelToDelete: string | null = null;

  // Variables
  downloadStages = [
    "pulling image",
    "verifying sha256 digest",
    "writing manifest",
    "success"
  ];

  // Listeners
  @Listen('promptEvent')
  handlePromptEvent(event: CustomEvent<string>) {
    this.promptText = event.detail;
    this.sendPrompt();
  }

  async componentWillLoad() {
    await this.isOllamaRunning();
    this.ollamaRunning = await this.isOllamaRunning();
  }

  connectedCallback() {
    this.renderer.code = ({ text }) => {
      if (typeof text !== 'string') return '';
      return `<div class="code-block-container">
                <button class="copy-button" onclick="this.closest('.code-block-container').querySelector('.copy-code').textContent && navigator.clipboard.writeText(this.closest('.code-block-container').querySelector('.copy-code').textContent)">Copy</button>
                <pre class="code-block"><code class="copy-code">${text}</code></pre>
              </div>`;
    };
    this.marked.setOptions({ renderer: this.renderer });
  }

  async isOllamaRunning(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();

        this.models = data.models.map((model: { name: string; size: number; }) => ({
          value: model.name,
          label: model.name + " | " + this.bytesToGbMb(model.size)
        }));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  @Method()
  async scrollToBottom() { // not working
    const messagesContainer = this.el.shadowRoot.querySelector('.messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  bytesToGbMb(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }

    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);

    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    } else {
      return `${mb.toFixed(2)} MB`;
    }
  }

  stopGeneration() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  addMessage(content: string, isUser: boolean) {
    this.chatHistory = [...this.chatHistory, { role: isUser ? 'user' : 'assistant', content }];
    this.scrollToBottom();
  }

  sendPrompt() {
    if (!this.promptText.trim()) return;

    this.isLoading = true; // Start loading
    this.controller = new AbortController();

    const selectedModel = (this.el.shadowRoot.querySelector('#model-select') as HTMLSelectElement).value;
    this.addMessage(this.promptText, true);

    let currentResponse = '';
    fetch('http://localhost:5000/api/chat', {
      signal: this.controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: this.promptText,
        model: selectedModel,
        history: this.chatHistory // Send entire chat history including the latest message
      })
    })
      .then(response => response.body.getReader())
      .then(reader => {
        this.isLoading = false; // Stop loading when response starts
        const decoder = new TextDecoder();
        this.addMessage('', false); // Create an empty assistant message placeholder

        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) return;

            const chunk = decoder.decode(value);
            chunk.split('\n').forEach(line => {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(6));
                  if (jsonData.text) {
                    currentResponse += jsonData.text;
                    this.chatHistory = this.chatHistory.map((msg, index) =>
                      index === this.chatHistory.length - 1 ? { role: 'assistant', content: currentResponse } : msg
                    );
                  }
                } catch (e) {
                  console.error('Error parsing JSON:', e);
                }
              }
            });
            readStream();
          });
        };
        readStream();
      })
      .catch(error => {
        this.isLoading = false; // Stop loading on error
        this.addMessage('Error: ' + error, false);
      })
      .finally(() => {
        this.controller = null;
      });

    this.promptText = '';
  }


  handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.modelName = target.value.trim(); // Trim spaces when updating state
  }

  async installOllamaModel() {
    if (!this.modelName) {
      alert('Please enter a valid model name.');
      return;
    }
  
    this.progress = 0; 
    this.statusMessage = "Starting download...";
    this.isInstalling = true;
  
    try {
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: this.modelName.trim() })
      });
  
      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to install model: ${error.error}`);
        this.statusMessage = "Installation failed.";
        this.isInstalling = false;
        return;
      }
  
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let isSuccessful = false;
  
      while (true) {
        const { done, value } = await reader?.read()!;
        if (done) break;
  
        const chunk = decoder.decode(value, { stream: true });
  
        try {
          const parsedChunk = JSON.parse(chunk);
          if (parsedChunk.error) {
            alert(`Failed to install model: ${parsedChunk.error}`);
            this.statusMessage = "Installation failed.";
            this.isInstalling = false;
            return;
          }
  
          if (parsedChunk.status) {
            this.statusMessage = parsedChunk.status;
  
            const stageIndex = this.downloadStages.indexOf(parsedChunk.status);
            if (stageIndex !== -1) {
              this.progress = ((stageIndex + 1) / this.downloadStages.length) * 100;
            }
  
            if (parsedChunk.status === "success") {
              alert(`Model "${this.modelName}" has been successfully installed.`);
              isSuccessful = true;
            }
          }
        } catch (error) {
          console.error('Error parsing chunk:', error);
        }
      }
  
      // Refresh installed models if download was successful
      if (isSuccessful) {
        await this.fetchInstalledModels();
      }
    } catch (error) {
      alert(`Network error: ${error.message}`);
      this.statusMessage = "Installation failed due to a network issue.";
    } finally {
      this.isInstalling = false;
    }
  }

  async fetchInstalledModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        this.installedModels = data.models;
      }
    } catch (error) {
      console.error('Error fetching installed models:', error);
    }
  }

  async removeModel(modelName: string) {
    this.modelToDelete = modelName;
  }

  async confirmRemoveModel() {
    if (!this.modelToDelete) return;

    try {
      const response = await fetch('http://localhost:11434/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: this.modelToDelete })
      });

      if (response.ok) {
        await this.fetchInstalledModels();
      } else {
        const error = await response.json();
        alert(`Failed to remove model: ${error.error}`);
      }
    } catch (error) {
      console.error('Error removing model:', error);
      alert(`Network error: ${error.message}`);
    } finally {
      this.modelToDelete = null;
    }
  }

  toggleModelDownloadVisible(newValue: boolean) {
    this.modelDownloadVisible = newValue;
    if (newValue) {
      this.fetchInstalledModels();
    }
  }

  render() {
    return (
      <div>
        {!this.ollamaRunning &&
          <div class="ollama-inactive-wrapper">
            <div class="ollama-inactive-modal">
              <h1>Warning</h1>
              <h4>Ollama <svg fill="currentColor" fill-rule="evenodd" height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Ollama</title><path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z"></path></svg> is not active on your machine.</h4>
              <h3>Is Ollama already installed on your machine?</h3>
              <h4>Just open the application and make sure it runs in the background.</h4>
              <h3>Don't have Ollama installed?</h3>
              <h4>You can download it from <a target="_blank" href="https://ollama.com/">here</a>.</h4>
            </div>
          </div>
        }

        {this.modelDownloadVisible &&
          <div class="ollama-inactive-wrapper">
            <div class="ollama-inactive-modal">
              <div class="model-management-modal-header">
                <h1>Ollama Model Management</h1>
                <svg on-click={() => this.toggleModelDownloadVisible(false)} width="55px" height="55px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#fff" d="M12 2C6.49 2 2 6.49 2 12C2 17.51 6.49 22 12 22C17.51 22 22 17.51 22 12C22 6.49 17.51 2 12 2ZM15.36 14.3C15.65 14.59 15.65 15.07 15.36 15.36C15.21 15.51 15.02 15.58 14.83 15.58C14.64 15.58 14.45 15.51 14.3 15.36L12 13.06L9.7 15.36C9.55 15.51 9.36 15.58 9.17 15.58C8.98 15.58 8.79 15.51 8.64 15.36C8.35 15.07 8.35 14.59 8.64 14.3L10.94 12L8.64 9.7C8.35 9.41 8.35 8.93 8.64 8.64C8.93 8.35 9.41 8.35 9.7 8.64L12 10.94L14.3 8.64C14.59 8.35 15.07 8.35 15.36 8.64C15.65 8.93 15.65 9.41 15.36 9.7L13.06 12L15.36 14.3Z" />
                </svg>
              </div>

              <section class="installed-models">
                <h3>Installed Models</h3>
                {this.modelToDelete && (
                  <div class="confirmation-dialog">
                    <p>Are you sure you want to delete the model {this.modelToDelete}?</p>
                    <div class="dialog-actions">
                      <button onClick={() => this.confirmRemoveModel()}>Yes</button>
                      <button onClick={() => this.modelToDelete = null}>No</button>
                    </div>
                  </div>
                )}
                {this.installedModels.length === 0 ? (
                  <p>No models installed</p>
                ) : (
                  <div class="models-table">
                    <div class="table-header">
                      <div>Model</div>
                      <div>Size</div>
                      <div>Family</div>
                      <div>Format</div>
                      <div>Parameters</div>
                      <div>Quantization</div>
                      <div></div>
                    </div>
                    {this.installedModels.map(model => (
                      <div class="table-row">
                        <div>{model.name}</div>
                        <div>{this.bytesToGbMb(model.size)}</div>
                        <div>{model.details.families?.join(', ') || 'N/A'}</div>
                        <div>{model.details.format}</div>
                        <div>{model.details.parameter_size}</div>
                        <div>{model.details.quantization_level}</div>
                        <div>
                          <svg onClick={() => this.removeModel(model.name)} width="30px" height="30px" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M352 192V95.936a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32V192h256a32 32 0 1 1 0 64H96a32 32 0 0 1 0-64h256zm64 0h192v-64H416v64zM192 960a32 32 0 0 1-32-32V256h704v672a32 32 0 0 1-32 32H192zm224-192a32 32 0 0 0 32-32V416a32 32 0 0 0-64 0v320a32 32 0 0 0 32 32zm192 0a32 32 0 0 0 32-32V416a32 32 0 0 0-64 0v320a32 32 0 0 0 32 32z" /></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section class="download-model">
                <h3>Download New Model</h3>
                <input placeholder="Model name..." type="text" onInput={(event) => this.handleInputChange(event)} />
                <button onClick={() => this.installOllamaModel()}>
                  Install
                </button>
                <div class="progress-container">
                  <p>{this.statusMessage}</p>
                  <progress value={this.progress} max="100"></progress>
                </div>
              </section>
            </div>
          </div>
        }

        <header>
          <div class="header-left">
            JoyGPT
            <span class="version-number">v1</span>
          </div>
          <div class="header-right">
            <svg on-click={() => this.toggleModelDownloadVisible(true)} class="add-model-icon" width="40px" height="40px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM12.75 9C12.75 8.58579 12.4142 8.25 12 8.25C11.5858 8.25 11.25 8.58579 11.25 9L11.25 11.25H9C8.58579 11.25 8.25 11.5858 8.25 12C8.25 12.4142 8.58579 12.75 9 12.75H11.25V15C11.25 15.4142 11.5858 15.75 12 15.75C12.4142 15.75 12.75 15.4142 12.75 15L12.75 12.75H15C15.4142 12.75 15.75 12.4142 15.75 12C15.75 11.5858 15.4142 11.25 15 11.25H12.75V9Z" />
            </svg>
            <select id="model-select">
              {this.models.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main>
          <div class="current-chat">
            {!this.chatHistory.length &&
              <div class="conversation-intro-message">
                <h1>What can I help with?</h1>
              </div>}
            <div class="messages">
              {this.chatHistory.map(msg => (
                <div class={{
                  'message': true,
                  'user-message': msg.role === 'user',
                  'assistant-message': msg.role === 'assistant'
                }}>
                  {msg.role === 'user'
                    ? <p>{msg.content}</p>
                    : <div innerHTML={marked.parse(msg.content).toString()}></div>
                  }
                </div>
              ))}
            </div>
            {this.isLoading && (
              <span class="loader"></span>
            )}
          </div>
          <joygpt-intro></joygpt-intro>
        </main>
      </div>
    );
  }
}
