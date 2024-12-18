// Initialize CodeMirror
let editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
    mode: "javascript",
    theme: "dracula",
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    extraKeys: {
        "Tab": "indentMore",
        "Shift-Tab": "indentLess",
        "Ctrl-Enter": function(cm) {
            runCode();
        },
        "Ctrl-S": function(cm) {
            checkCode();
        }
    }
});

editor.setSize("100%", "400px");

// DOM Elements
const languageSelect = document.getElementById('languageSelect');
const runButton = document.getElementById('runButton');
const output = document.getElementById('output');

// Create Check Code button with neon theme
const checkButton = document.createElement('button');
checkButton.textContent = 'Check Code';
checkButton.className = 'btn check-btn';
runButton.parentNode.insertBefore(checkButton, runButton);

// Language Configurations
const languageConfigs = {
    javascript: {
        mode: "javascript",
        linter: function(code) {
            JSHINT(code, {
                esversion: 9,
                asi: true,
                browser: true,
                undef: true,
                unused: true,
                devel: true
            });
            return JSHINT.errors.map(error => ({
                line: error.line,
                severity: error.code.startsWith('W') ? 'warning' : 'error',
                message: error.reason
            }));
        }
    },
    html: {
        mode: "xml",
        linter: function(code) {
            const errors = [];
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'text/html');
                const parseErrors = Array.from(doc.getElementsByTagName('parsererror'));
                
                if (parseErrors.length > 0) {
                    errors.push({
                        line: 1,
                        severity: 'error',
                        message: 'Invalid HTML structure'
                    });
                }

                // Check for common HTML issues
                const checks = [
                    { pattern: /<!DOCTYPE html>/i, message: 'Missing DOCTYPE declaration' },
                    { pattern: /<html[^>]*>/i, message: 'Missing <html> tag' },
                    { pattern: /<head[^>]*>/i, message: 'Missing <head> tag' },
                    { pattern: /<body[^>]*>/i, message: 'Missing <body> tag' },
                    { pattern: /<title[^>]*>/i, message: 'Missing <title> tag' },
                    { pattern: /<meta[^>]*charset/i, message: 'Missing charset meta tag' }
                ];

                checks.forEach(check => {
                    if (!check.pattern.test(code)) {
                        errors.push({
                            line: 1,
                            severity: 'warning',
                            message: check.message
                        });
                    }
                });
                // Check for unclosed tags
                const openTags = [];
                const tagPattern = /<\/?([a-z0-9]+)[^>]*>/gi;
                let match;
                let lineNum = 1;

                while ((match = tagPattern.exec(code)) !== null) {
                    const isClosing = match[0].startsWith('</');
                    const tagName = match[1].toLowerCase();
                    
                    if (!isClosing) {
                        if (!match[0].endsWith('/>')) {
                            openTags.push({ tag: tagName, line: lineNum });
                        }
                    } else {
                        if (openTags.length === 0 || openTags[openTags.length - 1].tag !== tagName) {
                            errors.push({
                                line: lineNum,
                                severity: 'error',
                                message: `Unexpected closing tag </${tagName}>`
                            });
                        } else {
                            openTags.pop();
                        }
                    }
                    
                    lineNum += (code.slice(0, match.index).match(/\n/g) || []).length;
                }

                openTags.forEach(tag => {
                    errors.push({
                        line: tag.line,
                        severity: 'error',
                        message: `Unclosed tag <${tag.tag}>`
                    });
                });

            } catch (error) {
                errors.push({
                    line: 1,
                    severity: 'error',
                    message: error.message
                });
            }
            return errors;
        }
    },
    python: {
        mode: "python",
        linter: function(code) {
            const errors = [];
            const lines = code.split('\n');
            let indentLevel = 0;
            const indentStack = [];

            lines.forEach((line, index) => {
                // Skip empty lines
                if (!line.trim()) return;

                // Check indentation
                const indent = line.match(/^[ ]*/)[0].length;
                if (indent % 4 !== 0) {
                    errors.push({
                        line: index + 1,
                        severity: 'warning',
                        message: 'Indentation should be a multiple of 4 spaces'
                    });
                }

                // Check for Python 3 print function
                if (line.includes('print') && !line.match(/print\s*\(/)) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Python 3 requires parentheses for print function'
                    });
                }

                // Check for colons in control structures
                if (line.match(/(if|for|while|def|class|else|elif|try|except|finally)\s+.*[^:]$/)) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Missing colon after control statement'
                    });
                }

                // Check indentation logic
                if (line.trim().endsWith(':')) {
                    indentStack.push(indent);
                    indentLevel = indent + 4;
                } else if (indent < indentLevel && indentStack.length > 0) {
                    while (indentStack.length && indentStack[indentStack.length - 1] >= indent) {
                        indentStack.pop();
                    }
                    indentLevel = indent;
                }

                // Check for common Python issues
                if (line.includes('xrange')) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'xrange() is not available in Python 3, use range() instead'
                    });
                }

                // Check string literals
                const stringLiterals = line.match(/['"]/g) || [];
                if (stringLiterals.length % 2 !== 0) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Unclosed string literal'
                    });
                }

                // Check for common syntax errors
                if (line.includes('=') && !line.match(/[^=]=[^=]/) && !line.match(/[=!<>]=/) && !line.includes('==')) {
                    errors.push({
                        line: index + 1,
                        severity: 'warning',
                        message: 'Single = used for comparison instead of =='
                    });
                }

                // Check for invalid variable names
                const invalidVarMatch = line.match(/\b(def|class|return|import|from)\s+\d/);
                if (invalidVarMatch) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Invalid identifier name starting with number'
                    });
                }
            });

            // Check overall indentation consistency
            if (indentStack.length > 0) {
                errors.push({
                    line: lines.length,
                    severity: 'error',
                    message: 'Inconsistent indentation: missing indented block'
                });
            }
            return errors;
        }
    },
    java: {
        mode: "text/x-java",
        linter: function(code) {
            const errors = [];
            const lines = code.split('\n');
            let classFound = false;
            let mainFound = false;
            let braceCount = 0;

            lines.forEach((line, index) => {
                // Check for class declaration
                if (line.includes('class')) {
                    classFound = true;
                }

                // Check for main method
                if (line.includes('public static void main')) {
                    mainFound = true;
                }

                // Check braces
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;

                // Check for semicolons
                if (line.trim() && 
                    !line.trim().endsWith('{') && 
                    !line.trim().endsWith('}') && 
                    !line.trim().endsWith(';') &&
                    !line.trim().startsWith('package') &&
                    !line.trim().startsWith('import') &&
                    !line.trim().startsWith('//') &&
                    !line.trim().startsWith('/*') &&
                    !line.trim().endsWith('*/') &&
                    !line.trim().startsWith('*') &&
                    !line.trim().startsWith('public class')) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Missing semicolon'
                    });
                }
            });

            if (!classFound) {
                errors.push({
                    line: 1,
                    severity: 'error',
                    message: 'No class declaration found'
                });
            }

            if (!mainFound) {
                errors.push({
                    line: 1,
                    severity: 'warning',
                    message: 'No main method found'
                });
            }

            if (braceCount !== 0) {
                errors.push({
                    line: lines.length,
                    severity: 'error',
                    message: braceCount > 0 ? 'Missing closing brace' : 'Extra closing brace'
                });
            }

            return errors;
        }
    },
    'c++': {
        mode: "text/x-csrc",
        linter: function(code) {
            const errors = [];
            const lines = code.split('\n');
            let mainFound = false;
            let braces = 0;
            const includes = new Set();

            lines.forEach((line, index) => {
                // Check includes
                if (line.includes('#include')) {
                    const match = line.match(/#include\s*<([^>]+)>/);
                    if (match) {
                        includes.add(match[1]);
                    }
                }

                // Check for main function
                if (line.includes('main')) {
                    mainFound = true;
                }

                // Check braces
                braces += (line.match(/{/g) || []).length;
                braces -= (line.match(/}/g) || []).length;

                // Check for semicolons
                if (line.trim() && 
                    !line.trim().endsWith('{') && 
                    !line.trim().endsWith('}') && 
                    !line.trim().endsWith(';') &&
                    !line.trim().startsWith('#') &&
                    !line.trim().startsWith('//')) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Missing semicolon'
                    });
                }

                // Check for common functions without proper includes
                if (line.includes('printf') && !includes.has('stdio.h')) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Using printf without #include <stdio.h>'
                    });
                }
                if (line.includes('malloc') && !includes.has('stdlib.h')) {
                    errors.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Using malloc without #include <stdlib.h>'
                    });
                }
            });

            if (!mainFound) {
                errors.push({
                    line: 1,
                    severity: 'error',
                    message: 'No main function found'
                });
            }

            if (braces !== 0) {
                errors.push({
                    line: lines.length,
                    severity: 'error',
                    message: braces > 0 ? 'Missing closing brace' : 'Extra closing brace'
                });
            }

            return errors;
        }
    }
};

// Event Listeners
languageSelect.addEventListener('change', () => {
    const selectedLanguage = languageSelect.value;
    editor.setOption('mode', languageConfigs[selectedLanguage].mode);
    editor.setValue(getDefaultCode(selectedLanguage));
});

runButton.addEventListener('click', runCode);
checkButton.addEventListener('click', checkCode);

// Code Check Function
function checkCode() {
    const code = editor.getValue();
    const language = languageSelect.value;
    const config = languageConfigs[language];
    
    if (!config || !config.linter) {
        output.innerHTML = `
            <div class="check-result">
                <h4>Code Check:</h4>
                <div class="message">Code checking is not available for ${language}</div>
            </div>
        `;
        return;
    }

    try {
        const errors = config.linter(code);
        displayOutput(errors);
    } catch (error) {
        output.innerHTML = `
            <div class="check-result error">
                <h4>Error:</h4>
                <div class="error-message">${error.message}</div>
            </div>
        `;
    }
}

// Display Output Function
function displayOutput(results) {
    if (!results || results.length === 0) {
        output.innerHTML = `
            <div class="check-result success">
                <h4>Success!</h4>
                <div class="message">No issues found in your code.</div>
            </div>
        `;
        return;
    }

    const resultHTML = results.map(result => `
        <div class="issue ${result.severity}">
            <span class="line">Line ${result.line}:</span>
            <span class="message">${result.message}</span>
        </div>
    `).join('');

    output.innerHTML = `
        <div class="check-result">
            <h4>Code Check Results:</h4>
            <div class="issues-list">
                ${resultHTML}
            </div>
        </div>
    `;
}

// Get Default Code Function
function getDefaultCode(language) {
    const samples = {
        javascript: `// Example: Factorial function
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    return n * factorial(n - 1);
}

console.log(factorial(5));`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Web Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Welcome to My Page</h1>
    <p>This is a sample HTML page with styling.</p>
</body>
</html>`,
        'c++': `#include <iostream>

int factorial(int n) {
    if (n == 0 || n == 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int n = 5;
    std::cout << "Factorial of " << n << " is " << factorial(n) << std::endl;
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
    return samples[language] || '';
}

// Run Code Function
function runCode() {
    const code = editor.getValue();
    const language = languageSelect.value;
    
    output.innerHTML = ''; // Clear previous output
    
    if (language === 'javascript') {
        try {
            // Create a safe evaluation environment
            const consoleOutput = [];
            const safeConsole = {
                log: (...args) => consoleOutput.push(args.join(' ')),
                error: (...args) => consoleOutput.push('Error: ' + args.join(' ')),
                warn: (...args) => consoleOutput.push('Warning: ' + args.join(' ')),
                info: (...args) => consoleOutput.push('Info: ' + args.join(' '))
            };
            
            // Create a safe context for evaluation
            const safeEval = new Function('console', `
                try {
                    ${code}
                } catch (error) {
                    console.error(error.message);
                }
            `);
            
            // Execute the code with safe console
            safeEval(safeConsole);
            
            // Display the output
            output.innerHTML = `
                <div class="execution-result">
                    <h4>Output:</h4>
                    <pre class="output-content">${consoleOutput.join('\n')}</pre>
                </div>
            `;
        } catch (error) {
            output.innerHTML = `
                <div class="execution-result error">
                    <h4>Error:</h4>
                    <pre class="error-message">${error.message}</pre>
                </div>
            `;
        }
    } else {
        // Show loading state
        output.innerHTML = `
            <div class="execution-result">
                <h4>Running ${language} code...</h4>
                <div class="loading-spinner"></div>
            </div>
        `;

        // Send code to backend for execution
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
            let resultHtml = `
                <div class="execution-result">
                    <h4>Output:</h4>
            `;

            if (data.error) {
                resultHtml += `<pre class="error-message">${data.error}</pre>`;
            }
            if (data.output) {
                resultHtml += `<pre class="output-content">${data.output}</pre>`;
            }

            resultHtml += `</div>`;
            output.innerHTML = resultHtml;
        })
        .catch(error => {
            output.innerHTML = `
                <div class="execution-result error">
                    <h4>Error:</h4>
                    <pre class="error-message">Failed to connect to the backend server. Make sure it's running on port 5000.</pre>
                </div>
            `;
        });
    }
}

// Initialize with JavaScript code
editor.setValue(getDefaultCode('javascript'));
