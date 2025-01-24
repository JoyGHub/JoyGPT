from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app)

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        prompt = data.get("prompt")
        model = data.get("model", "llama3.2:latest")  # Default to llama3.2:latest if not specified
        history = data.get("history", [])

        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400

        # Format the conversation history for the model
        formatted_prompt = ""
        for msg in history:
            formatted_prompt += f"{msg['role']}: {msg['content']}\n"
        formatted_prompt += f"user: {prompt}\nassistant:"

        ollama_request = {
            "model": model,
            "prompt": formatted_prompt,
            "stream": True
        }

        def generate():
            response = requests.post(
                "http://localhost:11434/api/generate",
                json=ollama_request,
                stream=True
            )
            
            for line in response.iter_lines():
                if line:
                    json_response = json.loads(line)
                    if 'response' in json_response:
                        yield f"data: {json.dumps({'text': json_response['response']})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=False, port=5000)