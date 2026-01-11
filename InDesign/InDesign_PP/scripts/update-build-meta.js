#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(command) {
    return execSync(command, {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8'
    }).trim();
}

function main() {
    const pluginRoot = path.resolve(__dirname, '..');
    const mainJsPath = path.join(pluginRoot, 'main.js');

    if (!fs.existsSync(mainJsPath)) {
        console.error(`main.js not found at: ${mainJsPath}`);
        process.exit(1);
    }

    let sha = '';
    try {
        // run from repo root so git works even if cwd is plugin folder
        sha = run('git rev-parse --short HEAD');
    } catch (e) {
        console.error('Failed to read git SHA. Is this a git repo and is git installed?');
        process.exit(1);
    }

    const src = fs.readFileSync(mainJsPath, 'utf8');

    const shaLineRe = /^const\s+BUILD_GIT_SHA\s*=\s*"[^"]*";\s*$/m;
    const newLine = `const BUILD_GIT_SHA = "${sha}";`;

    let out;
    if (shaLineRe.test(src)) {
        out = src.replace(shaLineRe, newLine);
    } else {
        // Insert near the top (after the first line or after 'use strict')
        const lines = src.split(/\r?\n/);
        let insertAt = 0;
        if (lines[0] && lines[0].includes('use strict')) insertAt = 1;
        lines.splice(insertAt, 0, newLine);
        out = lines.join('\n');
    }

    if (out !== src) {
        fs.writeFileSync(mainJsPath, out, 'utf8');
    }

    console.log(`Updated BUILD_GIT_SHA -> ${sha}`);
}

main();
