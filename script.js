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
    c: {
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
    const language = languageSelect.value;
    const config = languageConfigs[language];
    editor.setOption("mode", config.mode);
    editor.setValue(getDefaultCode(language));
});

checkButton.addEventListener('click', checkCode);
runButton.addEventListener('click', runCode);

// Code Check Function
function checkCode() {
    const code = editor.getValue();
    const language = languageSelect.value;
    let validationResult = [];

    switch (language) {
        case 'javascript':
            JSHINT(code);
            if (JSHINT.errors.length > 0) {
                validationResult = JSHINT.errors.map(error => ({
                    line: error.line,
                    severity: error.code.startsWith('W') ? 'warning' : 'error',
                    message: error.reason
                }));
            }
            break;

        case 'python':
            const lines = code.split('\n');
            let indentLevel = 0;
            const indentStack = [];

            lines.forEach((line, index) => {
                // Skip empty lines
                if (!line.trim()) return;

                // Check indentation
                const indent = line.match(/^[ ]*/)[0].length;
                if (indent % 4 !== 0) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'warning',
                        message: 'Indentation should be a multiple of 4 spaces'
                    });
                }

                // Check for Python 3 print function
                if (line.includes('print') && !line.match(/print\s*\(/)) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Python 3 requires parentheses for print function'
                    });
                }

                // Check for colons in control structures
                if (line.match(/(if|for|while|def|class|else|elif|try|except|finally)\s+.*[^:]$/)) {
                    validationResult.push({
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
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'xrange() is not available in Python 3, use range() instead'
                    });
                }

                // Check string literals
                const stringLiterals = line.match(/['"]/g) || [];
                if (stringLiterals.length % 2 !== 0) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Unclosed string literal'
                    });
                }

                // Check for common syntax errors
                if (line.includes('=') && !line.match(/[^=]=[^=]/) && !line.match(/[=!<>]=/) && !line.includes('==')) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'warning',
                        message: 'Single = used for comparison instead of =='
                    });
                }

                // Check for invalid variable names
                const invalidVarMatch = line.match(/\b(def|class|return|import|from)\s+\d/);
                if (invalidVarMatch) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Invalid identifier name starting with number'
                    });
                }
            });

            // Check overall indentation consistency
            if (indentStack.length > 0) {
                validationResult.push({
                    line: lines.length,
                    severity: 'error',
                    message: 'Inconsistent indentation: missing indented block'
                });
            }
            break;

        case 'html':
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'text/html');
                const parseErrors = Array.from(doc.getElementsByTagName('parsererror'));
                
                if (parseErrors.length > 0) {
                    validationResult.push({
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
                        validationResult.push({
                            line: 1,
                            severity: 'warning',
                            message: check.message
                        });
                    }
                });
            } catch (error) {
                validationResult.push({
                    line: 1,
                    severity: 'error',
                    message: error.message
                });
            }
            break;

        case 'java':
            const javaLines = code.split('\n');
            let classFound = false;
            let mainFound = false;
            let braceCount = 0;

            javaLines.forEach((line, index) => {
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
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Missing semicolon'
                    });
                }
            });

            if (!classFound) {
                validationResult.push({
                    line: 1,
                    severity: 'error',
                    message: 'No class declaration found'
                });
            }

            if (!mainFound) {
                validationResult.push({
                    line: 1,
                    severity: 'warning',
                    message: 'No main method found'
                });
            }

            if (braceCount !== 0) {
                validationResult.push({
                    line: javaLines.length,
                    severity: 'error',
                    message: braceCount > 0 ? 'Missing closing brace' : 'Extra closing brace'
                });
            }
            break;

        case 'c':
            const cLines = code.split('\n');
            let mainFoundC = false;
            let bracesC = 0;
            const includes = new Set();

            cLines.forEach((line, index) => {
                // Check includes
                if (line.includes('#include')) {
                    const match = line.match(/#include\s*<([^>]+)>/);
                    if (match) {
                        includes.add(match[1]);
                    }
                }

                // Check for main function
                if (line.includes('main')) {
                    mainFoundC = true;
                }

                // Check braces
                bracesC += (line.match(/{/g) || []).length;
                bracesC -= (line.match(/}/g) || []).length;

                // Check for semicolons
                if (line.trim() && 
                    !line.trim().endsWith('{') && 
                    !line.trim().endsWith('}') && 
                    !line.trim().endsWith(';') &&
                    !line.trim().startsWith('#') &&
                    !line.trim().startsWith('//')) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Missing semicolon'
                    });
                }

                // Check for common functions without proper includes
                if (line.includes('printf') && !includes.has('stdio.h')) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Using printf without #include <stdio.h>'
                    });
                }
                if (line.includes('malloc') && !includes.has('stdlib.h')) {
                    validationResult.push({
                        line: index + 1,
                        severity: 'error',
                        message: 'Using malloc without #include <stdlib.h>'
                    });
                }
            });

            if (!mainFoundC) {
                validationResult.push({
                    line: 1,
                    severity: 'error',
                    message: 'No main function found'
                });
            }

            if (bracesC !== 0) {
                validationResult.push({
                    line: cLines.length,
                    severity: 'error',
                    message: bracesC > 0 ? 'Missing closing brace' : 'Extra closing brace'
                });
            }
            break;
    }

    displayOutput(validationResult);
}

// Display Output Function
function displayOutput(results) {
    if (results.length === 0) {
        output.innerHTML = `
            <div class="check-result success">
                <h4>Code Check Results:</h4>
                <div class="message">✓ No issues found! Your code looks good.</div>
            </div>
        `;
        return;
    }

    const errorsList = results
        .sort((a, b) => a.line - b.line)
        .map(error => `
            <div class="check-item ${error.severity}">
                <span class="line">Line ${error.line}:</span>
                <span class="message">${error.message}</span>
            </div>
        `)
        .join('');

    output.innerHTML = `
        <div class="check-result">
            <h4>Code Check Results:</h4>
            <div class="results-list">
                ${errorsList}
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
    return samples[language] || '';
}

// Run Code Function
function runCode() {
    const code = editor.getValue();
    const language = languageSelect.value;
    
    // First, check the code
    checkCode();
    
    // Then show execution message
    output.innerHTML += `
        <div class="execution-result">
            <h4>Execution:</h4>
            <div class="message">
                Code execution is simulated. In a full environment, this would run your ${language} code.
            </div>
        </div>
    `;
}

// Initialize with JavaScript code
editor.setValue(getDefaultCode('javascript'));
