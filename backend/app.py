from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import tempfile
import signal
import time
from threading import Timer

app = Flask(__name__)
CORS(app)

MAX_EXECUTION_TIME = 5
MEMORY_LIMIT = "100M"

def create_temp_file(code, extension):
    temp = tempfile.NamedTemporaryFile(suffix=extension, delete=False)
    temp.write(code.encode())
    temp.close()
    return temp.name

def cleanup_temp_file(filename):
    try:
        os.unlink(filename)
    except:
        pass

def run_with_timeout(cmd, timeout_sec):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    timer = Timer(timeout_sec, proc.kill)
    try:
        timer.start()
        stdout, stderr = proc.communicate()
        return stdout.decode(), stderr.decode(), proc.returncode
    finally:
        timer.cancel()

@app.route('/execute', methods=['POST'])
def execute_code():
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        result = {'output': '', 'error': '', 'exitCode': 0}

        if language == 'python':
            filename = create_temp_file(code, '.py')
            try:
                stdout, stderr, exit_code = run_with_timeout(
                    ['python3', filename],
                    MAX_EXECUTION_TIME
                )
                result = {'output': stdout, 'error': stderr, 'exitCode': exit_code}
            finally:
                cleanup_temp_file(filename)

        elif language == 'java':
            filename = create_temp_file(code, '.java')
            try:
                class_name = 'Main'
                compile_output, compile_error, compile_code = run_with_timeout(
                    ['javac', filename],
                    MAX_EXECUTION_TIME
                )
                
                if compile_code == 0:
                    stdout, stderr, exit_code = run_with_timeout(
                        ['java', '-cp', os.path.dirname(filename), class_name],
                        MAX_EXECUTION_TIME
                    )
                    result = {'output': stdout, 'error': stderr, 'exitCode': exit_code}
                else:
                    result = {'output': '', 'error': compile_error, 'exitCode': compile_code}
            finally:
                cleanup_temp_file(filename)
                cleanup_temp_file(filename.replace('.java', '.class'))

        elif language == 'c++':
            filename = create_temp_file(code, '.cpp')
            output_file = filename[:-4]
            try:
                compile_output, compile_error, compile_code = run_with_timeout(
                    ['g++', filename, '-o', output_file],
                    MAX_EXECUTION_TIME
                )
                
                if compile_code == 0:
                    stdout, stderr, exit_code = run_with_timeout(
                        [output_file],
                        MAX_EXECUTION_TIME
                    )
                    result = {'output': stdout, 'error': stderr, 'exitCode': exit_code}
                else:
                    result = {'output': '', 'error': compile_error, 'exitCode': compile_code}
            finally:
                cleanup_temp_file(filename)
                cleanup_temp_file(output_file)

        else:
            return jsonify({'error': f'Unsupported language: {language}'}), 400

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
