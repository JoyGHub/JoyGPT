# JoyGPT

JoyGPT is a local web application built with StencilJS that allows users to interact offline with large language models (LLMs) via a simple and intuitive UI. Users can install and manage LLMs directly from the application using [Ollama](https://ollama.com/), a tool for running local language models.

## Features
- Simple and responsive UI to interact with local LLMs.
- Easy installation of models via the app interface.
- Built with StencilJS for fast and lightweight performance.

## Getting Started

### Prerequisites
Before running JoyGPT, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (recommended LTS version)
- [NPM](https://www.npmjs.com/) (comes with Node.js)
- [Ollama](https://ollama.com/) (for running local language models)

### Installation Steps

1. **Clone the Repository**
   ```sh
   git clone -b main https://github.com/JoyGHub/JoyGPT.git
   ```

2. **Enter the cloned directory**
   ```sh
   cd JoyGPT
   ```

3. **Install Dependencies**
   ```sh
   npm install
   ```

4. **Start the Application**

   Run **start_app.bat**. This will open two terminals. One for the UI, one for the backend.

   The application should automatically open in your default web browser at `http://localhost:3000`.

### Setting Up Large Language Models (LLMs)

Once the app is running, follow these steps to set up and use an LLM:

1. **Install Ollama**
   - Download and install Ollama from their official website: [ollama.com](https://ollama.com/).
   - Follow the installation instructions for your operating system.

2. **Download a Model via UI**
   - Open JoyGPT in your browser.
   - Enter the name of the LLM you want to install (e.g., `llama3.3`, `llama3.2`, `gemma:7b`, `deepseek-r1:7b`) into the input field.
   - Click the "Install Model" button.
   - The app will download and install the model for you.

3. **Download a Model via Terminal**

   You can also pull, remove, and run models via the terminal (Command Prompt / Windows PowerShell) by using the following commands:

   - **Show all available commands:**
     ```sh
     ollama help
     ```
   
   - **Pull a model:**
     ```sh
     ollama pull llama3.2
     ```
   
   - **Remove a model:**
     ```sh
     ollama rm llama3.2
     ```
   
   - **Run a model:**
     ```sh
     ollama run llama3.2
     ```

### Example Model Names
Some popular model names you can try installing (as of January 2025):

- `llama3.3`
- `llama3.2`
- `gemma:7b`
- `mistral`
- `deepseek-r1:7b`

### Verifying Installation
Once the model is installed successfully, you can select it via the app interface.

## Troubleshooting

If you encounter any issues:
- Ensure Ollama is properly installed and running.
- Check your internet connection when downloading models.
- Review the browser console for any errors related to the app.

## Contributing

We welcome contributions! Feel free to submit pull requests or report issues on our GitHub repository.

## License

This project is licensed under the MIT License.

---

Enjoy using JoyGPT!