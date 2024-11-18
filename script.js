let editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
    mode: "javascript",
    theme: "dracula",
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: true,
    extraKeys: {
        "Tab": "indentMore",
        "Shift-Tab": "indentLess",
        "Ctrl-Enter": function(cm) {
            checkCode();
        }
    }
});

editor.setSize("100%", "400px");

const languageSelect = document.getElementById('languageSelect');
const runButton = document.getElementById('runButton');
const output = document.getElementById('output');

const checkButton = document.createElement('button');
checkButton.textContent = 'Check Code';
checkButton.style.backgroundColor = '#4CAF50';
runButton.parentNode.insertBefore(checkButton, runButton);

languageSelect.addEventListener('change', () => {
    const language = languageSelect.value;
    const modes = {
        javascript: "javascript",
        html: "xml",
        c: "text/x-csrc",
        python: "python",
        java: "text/x-java"
    };
    editor.setOption("mode", modes[language]);

    const sampleCode = {
        javascript: `function factorial(n) {
    if (n === 0 || n === 1) return 1;
    return n * factorial(n - 1);
}

console.log(factorial(5));`,
        html: `<!DOCTYPE html>
<html>
<head>
    <title>My Web Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        }
        h1 { color: #333; }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to My Page</h1>
        <p>This is a sample HTML page with some styling.</p>
    </div>
</body>
</html>`,
        c: `#include <stdio.h>

int factorial(int n) {
    if (n == 0 || n == 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int n = 5;
    printf("Factorial of %d is %d\\n", n, factorial(n));
    return 0;
}`,
        python: `def factorial(n):
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))`,
        java: `public class Main {
    public static int factorial(int n) {
        if (n == 0 || n == 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        System.out.println(factorial(5));
    }
}`
    };
    editor.setValue(sampleCode[language]);
});

function checkCode() {
    const code = editor.getValue();
    const language = languageSelect.value;
    let validationResult = [];

    switch (language) {
        case 'javascript':
            JSHINT(code);
            if (JSHINT.errors.length > 0) {
                validationResult = JSHINT.errors.map(error => 
                    `Line ${error.line}: ${error.reason}`
                );
            }
            break;

        case 'html':
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'text/html');
                const errors = Array.from(doc.getElementsByTagName('parsererror'));
                
                if (errors.length > 0) {
                    validationResult.push('HTML Parsing Error: Invalid HTML structure');
                }
                if (!code.includes('<!DOCTYPE html>')) {
                    validationResult.push('Warning: Missing DOCTYPE declaration');
                }
                if (!code.match(/<html[^>]*>/)) {
                    validationResult.push('Warning: Missing <html> tag');
                }
                if (!code.match(/<head[^>]*>/)) {
                    validationResult.push('Warning: Missing <head> tag');
                }
                if (!code.match(/<body[^>]*>/)) {
                    validationResult.push('Warning: Missing <body> tag');
                }
            } catch (error) {
                validationResult.push(`HTML Validation Error: ${error.message}`);
            }
            break;

        case 'c':
            const cSyntaxErrors = [];
            if (!code.includes('main()') && !code.includes('main(void)') && !code.includes('main(int')) {
                cSyntaxErrors.push('Warning: No main function found');
            }
            if ((code.includes('printf') || code.includes('scanf')) && !code.includes('#include <stdio.h>')) {
                cSyntaxErrors.push('Warning: Using stdio functions without including <stdio.h>');
            }
            let braceCount = 0;
            for (let char of code) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                if (braceCount < 0) {
                    cSyntaxErrors.push('Error: Unmatched closing brace');
                    break;
                }
            }
            if (braceCount > 0) {
                cSyntaxErrors.push('Error: Missing closing brace');
            }
            const lines = code.split('\n');
            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (trimmedLine && 
                    !trimmedLine.startsWith('#') && 
                    !trimmedLine.endsWith('{') && 
                    !trimmedLine.endsWith('}') &&
                    !trimmedLine.endsWith(';')) {
                    cSyntaxErrors.push(`Line ${index + 1}: Missing semicolon`);
                }
            });
            validationResult = cSyntaxErrors;
            break;

        default:
            validationResult.push(`Code checking not implemented for ${language}`);
    }

    if (validationResult.length > 0) {
        output.innerHTML = '<h4>Code Check Results:</h4>' + 
            validationResult.map(error => `<div class="error">${error}</div>`).join('');
        output.style.color = '#ff6b6b';
    } else {
        output.innerHTML = '<h4>Code Check Results:</h4><div>No syntax errors found! ✓</div>';
        output.style.color = '#4CAF50';
    }
}

checkButton.addEventListener('click', checkCode);

editor.setValue(`function factorial(n) {
    if (n === 0 || n === 1) return 1;
    return n * factorial(n - 1);
}

console.log(factorial(5));`);

let previewFrame = null;

runButton.addEventListener('click', () => {
    const code = editor.getValue();
    const language = languageSelect.value;

    checkCode();
    output.innerHTML = "Running...";
    output.style.color = '#fff';

    try {
        if (language === "javascript") {
            const originalConsoleLog = console.log;
            let outputText = "";
            console.log = (...args) => {
                outputText += args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                ).join(" ") + "\n";
            };
            try {
                eval(code);
                output.innerHTML = outputText || "Code executed successfully!";
            } catch (error) {
                output.innerHTML = `Error: ${error.message}`;
                output.style.color = '#ff6b6b';
            }
            console.log = originalConsoleLog;
        } else if (language === "html") {
            if (previewFrame) {
                previewFrame.remove();
            }
            previewFrame = document.createElement('iframe');
            previewFrame.style.width = '100%';
            previewFrame.style.height = '300px';
            previewFrame.style.border = '1px solid #ccc';
            previewFrame.style.borderRadius = '4px';
            output.innerHTML = '';
            output.appendChild(previewFrame);
            previewFrame.contentDocument.open();
            previewFrame.contentDocument.write(code);
            previewFrame.contentDocument.close();
        } else {
            output.innerHTML = "Running code...";
            output.style.color = '#fff';
            fetch('http://localhost:5000/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    language: language,
                    code: code
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    output.innerHTML = `Error:\n${data.error}`;
                    output.style.color = '#ff6b6b';
                } else {
                    let result = '';
                    if (data.output) result += data.output;
                    if (data.error) result += `\nErrors/Warnings:\n${data.error}`;
                    output.innerHTML = result || "Code executed successfully!";
                    output.style.color = data.error ? '#ff6b6b' : '#4CAF50';
                }
            })
            .catch(error => {
                output.innerHTML = `Error connecting to server: ${error.message}\nMake sure the backend server is running.`;
                output.style.color = '#ff6b6b';
            });
        }
    } catch (error) {
        output.innerHTML = `Error: ${error.message}`;
        output.style.color = '#ff6b6b';
    }
});
