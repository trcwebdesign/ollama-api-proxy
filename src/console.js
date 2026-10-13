// console.js - Simplified ColorConsole for Node.js
import { WriteStream } from 'node:tty';

export class ColorConsole {
    constructor({ stdout = process.stdout, stderr = process.stderr, timestamp = false } = {}) {
        this.stdout = stdout;
        this.stderr = stderr;
        this.timestamp = timestamp;
        this.timers = new Map();
    }

    static colors = {
        reset: '\x1b[0m',
        red: '\x1b[91m',
        green: '\x1b[92m',
        yellow: '\x1b[93m',
        magenta: '\x1b[95m',
        cyan: '\x1b[96m',
        white: '\x1b[97m',
        gray: '\x1b[37m',
        bold: '\x1b[1m',
    };

    colorize(text, color, bold = false) {
        const hasColor = this.stdout instanceof WriteStream && this.stdout.isTTY;
        const emphasis = bold ? ColorConsole.colors.bold : '';
        return hasColor ? `${emphasis}${ColorConsole.colors[color]}${text}${ColorConsole.colors.reset}` : text;
    }

    formatJson(value, depth = 0, highlight = false, key = null) {
        const indent = '  '.repeat(depth);
        const childIndent = '  '.repeat(depth + 1);
        let formatted;

        if (Array.isArray(value)) {
            formatted = value.length
                ? `[\n${value.map(item => `${childIndent}${this.formatJson(item, depth + 1, highlight)}`).join(',\n')}\n${indent}]`
                : '[]';
        } else if (value && typeof value === 'object') {
            const entries = Object.entries(value);
            formatted = entries.length
                ? `{\n${entries.map(([key, item]) => {
                    const coloredKey = this.colorize(JSON.stringify(key), 'cyan');
                    const separator = this.colorize(': ', 'white');
                    return `${childIndent}${coloredKey}${separator}${this.formatJson(item, depth + 1, highlight || key === 'content', key)}`;
                }).join(',\n')}\n${indent}}`
                : '{}';
        } else if (typeof value === 'string') {
            if (key === 'body') {
                const lines = value.split(/\r?\n/).filter(line => line.trim());
                try {
                    const decoded = lines.map(line => JSON.parse(line));
                    formatted = decoded.length
                        ? this.formatJson(decoded.length === 1 ? decoded[0] : decoded, depth, highlight)
                        : this.colorize(JSON.stringify(value), highlight ? 'yellow' : 'green', highlight);
                } catch {
                    formatted = this.colorize(JSON.stringify(value), highlight ? 'yellow' : 'green', highlight);
                }
            } else if (key === 'content' && /^[\s]*[\[{]/.test(value)) {
                try {
                    const decoded = JSON.parse(value);
                    formatted = decoded && typeof decoded === 'object'
                        ? this.formatJson(decoded, depth, true)
                        : this.colorize(JSON.stringify(value), 'yellow', true);
                } catch {
                    formatted = this.colorize(JSON.stringify(value), 'yellow', true);
                }
            } else {
                formatted = this.colorize(JSON.stringify(value), highlight ? 'yellow' : 'green', highlight);
            }
        } else if (typeof value === 'number') {
            formatted = this.colorize(String(value), 'yellow', highlight);
        } else if (typeof value === 'boolean') {
            formatted = this.colorize(String(value), highlight ? 'yellow' : 'magenta', highlight);
        } else {
            formatted = this.colorize('null', highlight ? 'yellow' : 'red', highlight);
        }

        return formatted;
    }

    format(args, prefix = '', color = null) {
        const message = args.map(arg => arg !== null && typeof arg === 'object'
            ? this.formatJson(arg)
            : String(arg)).join(' ');
        const colored = color ? this.colorize(prefix + message, color) : prefix + message;
        const timestamp = this.timestamp ? `${this.colorize(`[${new Date().toLocaleString()}]`, 'gray')} ` : '';
        return timestamp + colored;
    }

    log(...args) {
        this.stdout.write(this.format(args) + '\n');
    }

    info(...args) {
        this.stdout.write(this.format(args, 'ℹ️ ', 'cyan') + '\n');
    }

    warn(...args) {
        this.stderr.write(this.format(args, '⚠️ ', 'yellow') + '\n');
    }

    error(...args) {
        this.stderr.write(this.format(args, '❌ ', 'red') + '\n');
    }

    debug(...args) {
        if (process.env.NODE_ENV !== 'production') {
            this.stdout.write(this.format(args, '🐛 ', 'magenta') + '\n');
        }
    }

    success(...args) {
        this.stdout.write(this.format(args, '✅ ', 'green') + '\n');
    }

    assert(condition, ...args) {
        if (!condition) {
            this.error('Assertion failed:', ...args);
        }
    }

    time(label) {
        this.timers.set(label, Date.now());
    }

    timeEnd(label) {
        if (this.timers.has(label)) {
            const elapsed = Date.now() - this.timers.get(label);
            this.timers.delete(label);
            this.log(`${label}: ${elapsed}ms`);
        }
    }

    clear() {
        if (this.stdout instanceof WriteStream && this.stdout.isTTY) {
            this.stdout.write('\x1b[2J\x1b[H');
        }
    }

    // Aliases
    dir = this.log;
    trace = this.debug;
}